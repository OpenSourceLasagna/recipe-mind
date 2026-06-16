import json
from uuid import UUID

import numpy as np
from openai import AsyncOpenAI
from sklearn.cluster import AgglomerativeClustering
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database.repositories.ingredients_categories_repository import (
    IngredientCategoryRepository,
)
from src.database.repositories.recipe_ingredients_repository import (
    RecipeIngredientRepository,
)
from src.models.ingredient_category import IngredientCategory
from src.models.recipe_ingredient import RecipeIngredient
from src.services.embeddings.base_embedding_service import BaseEmbeddingService

CENTROID_MATCH_NEW_INGREDIENTS_COSINE_SIMILARITY = 0.55
CENTROID_MERGE_CLUSTER_COSINE_SIMILARITY = 0.6
AGGLOMERATIVE_DISTANCE_THRESHOLD = 0.49


class CategoryMatchingService:
    def __init__(
        self,
        embedding_model: BaseEmbeddingService,
        session_factory: async_sessionmaker[AsyncSession],
        openai_client: AsyncOpenAI | None = None,
    ):
        self.embedder = embedding_model
        self.session_factory = session_factory
        self.openai_client = openai_client

    async def categorize_uncategorized_ingredients(self) -> None:
        async with self.session_factory() as session:
            ingredient_repo = RecipeIngredientRepository(session)
            category_repo = IngredientCategoryRepository(session)
            await self._run(ingredient_repo, category_repo)
            await session.commit()

    async def _run(
        self,
        ingredient_repo: RecipeIngredientRepository,
        category_repo: IngredientCategoryRepository,
    ) -> None:
        uncategorized = await ingredient_repo.get_uncategorized()
        if not uncategorized:
            return

        assignments: dict[UUID, UUID] = {}

        # --- Phase 1: match by normalized_name ---
        uncategorized, name_assignments = await self._match_by_name(
            uncategorized, ingredient_repo
        )
        assignments.update(name_assignments)

        if not uncategorized:
            await self._persist_assignments(assignments, ingredient_repo)
            return

        # --- Phase 2: match by centroid proximity ---
        uncategorized, centroid_assignments = await self._match_by_centroid(
            uncategorized, ingredient_repo
        )
        assignments.update(centroid_assignments)

        if not uncategorized:
            await self._persist_assignments(assignments, ingredient_repo)
            return

        # --- Phase 3: cluster remaining ---
        embedded = [i for i in uncategorized if i.embedding is not None]
        unembedded = [i for i in uncategorized if i.embedding is None]

        clusters = self._cluster_ingredients(embedded)

        # --- Phase 4: process clusters into categories ---
        cluster_assignments, new_categories = await self._process_clusters(
            clusters, category_repo, ingredient_repo, unembedded_ingredients=unembedded
        )
        assignments.update(cluster_assignments)

        # --- Phase 5: name new categories ---
        if new_categories:
            await self._name_and_persist_categories(new_categories, category_repo)

        await self._persist_assignments(assignments, ingredient_repo)

    async def _match_by_name(
        self,
        uncategorized: list[RecipeIngredient],
        ingredient_repo: RecipeIngredientRepository,
    ) -> tuple[list[RecipeIngredient], dict[UUID, UUID]]:
        names = {i.normalized_name for i in uncategorized if i.normalized_name}
        if not names:
            return uncategorized, {}

        matched = await ingredient_repo.get_categorized_by_normalized_names(list(names))
        name_to_category: dict[str, UUID] = {}
        for ing in matched:
            if ing.normalized_name and ing.category_id:
                name_to_category[ing.normalized_name] = ing.category_id

        assignments: dict[UUID, UUID] = {}
        remaining: list[RecipeIngredient] = []
        for ing in uncategorized:
            if ing.normalized_name and ing.normalized_name in name_to_category:
                assignments[ing.id] = name_to_category[ing.normalized_name]
            else:
                remaining.append(ing)

        return remaining, assignments

    async def _match_by_centroid(
        self,
        uncategorized: list[RecipeIngredient],
        ingredient_repo: RecipeIngredientRepository,
    ) -> tuple[list[RecipeIngredient], dict[UUID, UUID]]:
        centroids = await ingredient_repo.get_centroids()
        if not centroids:
            return uncategorized, {}

        centroid_pairs: list[tuple[UUID, np.ndarray]] = []
        for c in centroids:
            if c.embedding is not None and c.category_id is not None:
                centroid_pairs.append((c.category_id, np.array(c.embedding)))

        if not centroid_pairs:
            return uncategorized, {}

        cat_ids, cat_embs = zip(*centroid_pairs)
        cat_embs = np.array(cat_embs)

        assignments: dict[UUID, UUID] = {}
        remaining: list[RecipeIngredient] = []
        for ing in uncategorized:
            if ing.embedding is None:
                remaining.append(ing)
                continue
            emb = np.array(ing.embedding)
            sims = cat_embs @ emb
            best = int(np.argmax(sims))
            if sims[best] >= CENTROID_MATCH_NEW_INGREDIENTS_COSINE_SIMILARITY:
                assignments[ing.id] = cat_ids[best]
            else:
                remaining.append(ing)

        return remaining, assignments

    def _cluster_ingredients(
        self, ingredients: list[RecipeIngredient]
    ) -> dict[int, list[RecipeIngredient]]:
        emb_list = [np.array(ing.embedding) for ing in ingredients]
        X = np.array(emb_list)

        clustering = AgglomerativeClustering(
            linkage="average",
            metric="cosine",
            n_clusters=None,
            distance_threshold=AGGLOMERATIVE_DISTANCE_THRESHOLD,
        )
        labels = clustering.fit_predict(X)

        clusters: dict[int, list[RecipeIngredient]] = {}
        for ing, label in zip(ingredients, labels):
            clusters.setdefault(int(label), []).append(ing)
        return clusters

    async def _process_clusters(
        self,
        clusters: dict[int, list[RecipeIngredient]],
        category_repo: IngredientCategoryRepository,
        ingredient_repo: RecipeIngredientRepository,
        unembedded_ingredients: list[RecipeIngredient] | None = None,
    ) -> tuple[
        dict[UUID, UUID], list[tuple[int, list[RecipeIngredient], RecipeIngredient]]
    ]:
        new_categories: list[tuple[int, list[RecipeIngredient], RecipeIngredient]] = []
        singleton_ingredients: list[RecipeIngredient] = (
            list(unembedded_ingredients) if unembedded_ingredients else []
        )
        assignments: dict[UUID, UUID] = {}

        # Load existing centroids for reuse check
        all_categories = await category_repo.get_all()
        centroids = await ingredient_repo.get_centroids()
        cent_emb_map: dict[UUID, np.ndarray] = {}
        for c in centroids:
            if c.embedding is not None:
                cent_emb_map[c.id] = np.array(c.embedding)
        existing_centroid_data: list[tuple[UUID, np.ndarray]] = []
        for cat in all_categories:
            emb = cent_emb_map.get(cat.centroid_id)
            if emb is not None:
                existing_centroid_data.append((cat.id, emb))

        for label, members in clusters.items():
            # Singletons: check centroid reuse, else → Misc
            if len(members) == 1:
                if existing_centroid_data:
                    emb = np.array(members[0].embedding)
                    ex_cat_ids, ex_embs = zip(*existing_centroid_data)
                    ex_embs = np.array(ex_embs)
                    reuse_sims = ex_embs @ emb
                    best_reuse = int(np.argmax(reuse_sims))
                    if (
                        reuse_sims[best_reuse]
                        >= CENTROID_MERGE_CLUSTER_COSINE_SIMILARITY
                    ):
                        assignments[members[0].id] = ex_cat_ids[best_reuse]
                        continue

                singleton_ingredients.append(members[0])
                continue

            # Clusters (2+ members): always create a new category
            member_embs = np.array([np.array(m.embedding) for m in members])
            centroid_vec = member_embs.mean(axis=0)
            centroid_vec = centroid_vec / np.linalg.norm(centroid_vec)

            sims = member_embs @ centroid_vec
            centroid_idx = int(np.argmax(sims))
            centroid_ingredient = members[centroid_idx]

            new_categories.append((label, members, centroid_ingredient))

        # Handle singletons
        misc_category = await category_repo.get_by_name("Misc")
        if singleton_ingredients:
            if misc_category is None:
                misc_category = IngredientCategory(
                    category_name="Misc",
                    centroid_id=singleton_ingredients[0].id,
                )
                misc_category = await category_repo.create(misc_category)

            for ing in singleton_ingredients:
                assignments[ing.id] = misc_category.id

        return assignments, new_categories

    async def _name_and_persist_categories(
        self,
        new_category_groups: list[tuple[int, list[RecipeIngredient], RecipeIngredient]],
        category_repo: IngredientCategoryRepository,
    ) -> None:
        if not new_category_groups:
            return

        cluster_names = await self._generate_cluster_names(new_category_groups)

        for label, members, centroid_ingredient in new_category_groups:
            name = cluster_names.get(label, f"Group {label}")
            category = IngredientCategory(
                category_name=name,
                centroid_id=centroid_ingredient.id,
                ingredients=members,
            )
            await category_repo.create(category)

    async def _generate_cluster_names(
        self,
        new_category_groups: list[tuple[int, list[RecipeIngredient], RecipeIngredient]],
    ) -> dict[int, str]:
        if self.openai_client is None:
            return {
                label: f"Ingredient Group {label}"
                for label, _, _ in new_category_groups
            }

        cluster_texts: list[str] = []
        for label, members, _ in new_category_groups:
            names = ", ".join(sorted({m.ingredient_name for m in members}))
            cluster_texts.append(f"Group {label}: [{names}]")

        prompt = (
            "You are categorizing recipe ingredients. For each group of ingredients below, "
            "suggest a single concise category name (1-3 words) that best describes the group.\n"
            "Respond in JSON format with the group label as key and the category name as value.\n"
            'Use the exact raw integer string as the key (e.g. "0", "1", "2").\n\n'
            + "\n".join(cluster_texts)
        )

        response = await self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        if raw is None:
            raise ValueError("LLM returned empty response for category naming")

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {
                label: f"Ingredient Group {label}"
                for label, _, _ in new_category_groups
            }

        result: dict[int, str] = {}
        for label, _, _ in new_category_groups:
            key = str(label)
            raw_name = parsed.get(key)
            if raw_name is None:
                result[label] = f"Ingredient Group {label}"
            else:
                result[label] = str(raw_name).strip()

        return result

    async def _persist_assignments(
        self,
        assignments: dict[UUID, UUID],
        ingredient_repo: RecipeIngredientRepository,
    ) -> None:
        if not assignments:
            return
        await ingredient_repo.bulk_update_categories(list(assignments.items()))
