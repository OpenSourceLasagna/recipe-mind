from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.models.ingredient_category import IngredientCategory
from src.models.recipe_ingredient import RecipeIngredient
from src.services.category_matching_service import (
    AGGLOMERATIVE_DISTANCE_THRESHOLD,
    CENTROID_MATCH_NEW_INGREDIENTS_COSINE_SIMILARITY,
    CENTROID_MERGE_CLUSTER_COSINE_SIMILARITY,
)


class TestCategorizeUncategorized:
    async def test_no_uncategorized_returns_early(self, category_matcher, mock_session):
        mock_session.exec.return_value.all.return_value = []

        await category_matcher.categorize_uncategorized_ingredients()

        mock_session.commit.assert_called_once()

    async def test_calls_run_and_commits(self, category_matcher, mock_session):
        mock_session.exec.return_value.all.return_value = []
        await category_matcher.categorize_uncategorized_ingredients()
        mock_session.commit.assert_called_once()


class TestMatchByName:
    async def test_all_matched(
        self,
        category_matcher,
        uncategorized_ingredients,
        ingredient_repo,
    ):
        cat_id = uuid4()
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock(
            return_value=[
                RecipeIngredient(
                    id=uuid4(),
                    recipe_id=uuid4(),
                    ingredient_name="tomato",
                    normalized_name="tomato",
                    category_id=cat_id,
                ),
            ]
        )

        remaining, assignments = await category_matcher._match_by_name(
            uncategorized_ingredients, ingredient_repo
        )

        assert len(remaining) == 1
        assert remaining[0].ingredient_name == "basil"
        assert uncategorized_ingredients[0].id in assignments
        assert assignments[uncategorized_ingredients[0].id] == cat_id

    async def test_no_names_returns_all_as_remaining(
        self,
        category_matcher,
        uncategorized_ingredients,
        ingredient_repo,
    ):
        for ing in uncategorized_ingredients:
            ing.normalized_name = None
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock()

        remaining, assignments = await category_matcher._match_by_name(
            uncategorized_ingredients, ingredient_repo
        )

        assert len(remaining) == 2
        assert assignments == {}

    async def test_no_matched_names_returns_all_remaining(
        self,
        category_matcher,
        uncategorized_ingredients,
        ingredient_repo,
    ):
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock(return_value=[])

        remaining, assignments = await category_matcher._match_by_name(
            uncategorized_ingredients, ingredient_repo
        )

        assert len(remaining) == 2
        assert assignments == {}


class TestMatchByCentroid:
    async def test_all_above_threshold_assigns(
        self,
        category_matcher,
        make_ingredient,
        ingredient_repo,
        category_id,
    ):
        ingredients = [
            make_ingredient(
                ingredient_name="butter",
                normalized_name="butter",
                embedding=[0.5, 0.5, 0.5],
                category_id=None,
            )
        ]
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[
                make_ingredient(
                    embedding=[0.5, 0.5, 0.5],
                    category_id=category_id,
                )
            ]
        )

        remaining, assignments = await category_matcher._match_by_centroid(
            ingredients, ingredient_repo
        )

        assert len(remaining) == 0
        assert ingredients[0].id in assignments
        assert assignments[ingredients[0].id] == category_id

    async def test_below_threshold_remains_uncategorized(
        self,
        category_matcher,
        make_ingredient,
        ingredient_repo,
    ):
        ingredients = [
            make_ingredient(
                ingredient_name="exotic_fruit",
                normalized_name="exotic_fruit",
                embedding=[-0.9, 0.1, 0.0],
                category_id=None,
            )
        ]
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[
                make_ingredient(
                    embedding=[0.5, 0.5, 0.5],
                    category_id=uuid4(),
                )
            ]
        )

        remaining, assignments = await category_matcher._match_by_centroid(
            ingredients, ingredient_repo
        )

        assert len(remaining) == 1
        assert assignments == {}

    async def test_no_centroids_returns_all_as_remaining(
        self,
        category_matcher,
        uncategorized_ingredients,
        ingredient_repo,
    ):
        ingredient_repo.get_centroids = AsyncMock(return_value=[])

        remaining, assignments = await category_matcher._match_by_centroid(
            uncategorized_ingredients, ingredient_repo
        )

        assert len(remaining) == 2
        assert assignments == {}

    async def test_ingredient_without_embedding_goes_to_remaining(
        self,
        category_matcher,
        make_ingredient,
        ingredient_repo,
    ):
        ingredient = make_ingredient(
            ingredient_name="unknown",
            embedding=None,
            category_id=None,
        )
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[
                make_ingredient(embedding=[0.5, 0.5, 0.5], category_id=uuid4())
            ]
        )

        remaining, assignments = await category_matcher._match_by_centroid(
            [ingredient], ingredient_repo
        )

        assert len(remaining) == 1
        assert assignments == {}

    async def test_centroid_without_embedding_skipped(
        self,
        category_matcher,
        make_ingredient,
        ingredient_repo,
    ):
        ingredient = make_ingredient(embedding=[0.5, 0.5, 0.5], category_id=None)
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[make_ingredient(embedding=None, category_id=uuid4())]
        )

        remaining, assignments = await category_matcher._match_by_centroid(
            [ingredient], ingredient_repo
        )

        assert assignments == {}

    async def test_centroid_without_category_id_skipped(
        self,
        category_matcher,
        make_ingredient,
        ingredient_repo,
    ):
        ingredient = make_ingredient(embedding=[0.5, 0.5, 0.5], category_id=None)
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[make_ingredient(embedding=[0.5, 0.5, 0.5], category_id=None)]
        )

        remaining, assignments = await category_matcher._match_by_centroid(
            [ingredient], ingredient_repo
        )

        assert assignments == {}


class TestClusterIngredients:
    def test_single_cluster_all_similar(self, category_matcher, make_ingredient):
        ingredients = [
            make_ingredient(embedding=[0.5, 0.5, 0.5]),
            make_ingredient(embedding=[0.51, 0.49, 0.5]),
        ]

        clusters = category_matcher._cluster_ingredients(ingredients)

        assert len(clusters) == 1
        all_ids = {id(ing) for cluster in clusters.values() for ing in cluster}
        assert all_ids == {id(ingredients[0]), id(ingredients[1])}

    def test_two_distinct_clusters(self, category_matcher, make_ingredient):
        ingredients = [
            make_ingredient(embedding=[0.5, 0.5, 0.5]),
            make_ingredient(embedding=[0.51, 0.49, 0.5]),
            make_ingredient(embedding=[-0.5, -0.5, -0.5]),
            make_ingredient(embedding=[-0.49, -0.51, -0.5]),
        ]

        clusters = category_matcher._cluster_ingredients(ingredients)

        assert 2 <= len(clusters) <= 3

    def test_two_identical_ingredients_cluster_together(
        self, category_matcher, make_ingredient
    ):
        ingredients = [
            make_ingredient(embedding=[0.5, 0.5, 0.5]),
            make_ingredient(embedding=[0.5, 0.5, 0.5]),
        ]
        clusters = category_matcher._cluster_ingredients(ingredients)
        assert len(clusters) == 1


class TestProcessClusters:
    async def test_singleton_reuses_existing_centroid(
        self,
        category_matcher,
        make_ingredient,
        category_repo,
        ingredient_repo,
        category_id,
    ):
        centroid_ing = make_ingredient(
            embedding=[0.5, 0.5, 0.5],
            category_id=category_id,
        )
        close_embedding = [0.501, 0.499, 0.5]
        singleton = make_ingredient(
            embedding=close_embedding,
            category_id=None,
        )
        clusters = {0: [singleton]}
        category_repo.get_all = AsyncMock(
            return_value=[
                IngredientCategory(
                    id=category_id,
                    category_name="Vegetables",
                    centroid_id=centroid_ing.id,
                )
            ]
        )
        ingredient_repo.get_centroids = AsyncMock(return_value=[centroid_ing])

        assignments, new_cats = await category_matcher._process_clusters(
            clusters, category_repo, ingredient_repo
        )

        assert singleton.id in assignments
        assert assignments[singleton.id] == category_id
        assert len(new_cats) == 0

    async def test_singleton_below_threshold_goes_to_misc(
        self,
        category_matcher,
        make_ingredient,
        category_repo,
        ingredient_repo,
        category_id,
    ):
        centroid_ing = make_ingredient(
            embedding=[0.5, 0.5, 0.5],
            category_id=category_id,
        )
        far_embedding = [-0.9, 0.1, 0.0]
        singleton = make_ingredient(
            embedding=far_embedding,
            category_id=None,
        )
        clusters = {0: [singleton]}

        category_repo.get_all = AsyncMock(
            return_value=[
                IngredientCategory(
                    id=category_id,
                    category_name="Vegetables",
                    centroid_id=centroid_ing.id,
                )
            ]
        )
        ingredient_repo.get_centroids = AsyncMock(return_value=[centroid_ing])
        misc_category = IngredientCategory(
            id=uuid4(),
            category_name="Misc",
            centroid_id=singleton.id,
        )
        category_repo.get_by_name = AsyncMock(return_value=misc_category)

        assignments, new_cats = await category_matcher._process_clusters(
            clusters, category_repo, ingredient_repo
        )

        assert singleton.id in assignments
        assert assignments[singleton.id] == misc_category.id
        assert len(new_cats) == 0

    async def test_misc_category_created_if_not_exists(
        self,
        category_matcher,
        make_ingredient,
        category_repo,
        ingredient_repo,
    ):
        singleton = make_ingredient(
            embedding=[0.5, 0.5, 0.5],
            category_id=None,
        )
        clusters = {0: [singleton]}
        category_repo.get_all = AsyncMock(return_value=[])
        ingredient_repo.get_centroids = AsyncMock(return_value=[])
        category_repo.get_by_name = AsyncMock(return_value=None)
        created_misc = IngredientCategory(
            id=uuid4(),
            category_name="Misc",
            centroid_id=singleton.id,
        )
        category_repo.create = AsyncMock(return_value=created_misc)

        assignments, new_cats = await category_matcher._process_clusters(
            clusters, category_repo, ingredient_repo
        )

        category_repo.create.assert_called_once()
        created_cat = category_repo.create.call_args[0][0]
        assert created_cat.category_name == "Misc"
        assert singleton.id in assignments

    async def test_multi_member_cluster_creates_new_category(
        self,
        category_matcher,
        make_ingredient,
        category_repo,
        ingredient_repo,
    ):
        members = [
            make_ingredient(embedding=[0.5, 0.5, 0.5], category_id=None),
            make_ingredient(embedding=[0.51, 0.49, 0.5], category_id=None),
        ]
        clusters = {0: members}
        category_repo.get_all = AsyncMock(return_value=[])
        ingredient_repo.get_centroids = AsyncMock(return_value=[])

        assignments, new_cats = await category_matcher._process_clusters(
            clusters, category_repo, ingredient_repo
        )

        assert len(assignments) == 0
        assert len(new_cats) == 1
        label, cluster_members, centroid = new_cats[0]
        assert label == 0
        assert len(cluster_members) == 2
        assert centroid in cluster_members

    async def test_unembedded_ingredients_go_to_misc(
        self,
        category_matcher,
        make_ingredient,
        category_repo,
        ingredient_repo,
    ):
        unembedded = [
            make_ingredient(embedding=None, category_id=None),
        ]
        category_repo.get_all = AsyncMock(return_value=[])
        ingredient_repo.get_centroids = AsyncMock(return_value=[])
        category_repo.get_by_name = AsyncMock(return_value=None)
        created_misc = IngredientCategory(
            id=uuid4(),
            category_name="Misc",
            centroid_id=unembedded[0].id,
        )
        category_repo.create = AsyncMock(return_value=created_misc)

        assignments, new_cats = await category_matcher._process_clusters(
            {}, category_repo, ingredient_repo, unembedded_ingredients=unembedded
        )

        assert unembedded[0].id in assignments
        assert assignments[unembedded[0].id] == created_misc.id


class TestNameAndPersistCategories:
    async def test_with_openai_client(
        self,
        category_matcher,
        category_repo,
        mock_session,
        make_ingredient,
    ):
        members = [
            make_ingredient(ingredient_name="Tomato"),
            make_ingredient(ingredient_name="Onion"),
        ]
        new_cats = [(0, members, members[0])]

        await category_matcher._name_and_persist_categories(new_cats, category_repo)

        mock_session.add.assert_called_once()
        created = mock_session.add.call_args[0][0]
        assert created.category_name == "Vegetables"

    async def test_without_openai_client_uses_fallback_name(
        self,
        category_matcher_no_openai,
        category_repo,
        mock_session,
        make_ingredient,
    ):
        members = [
            make_ingredient(ingredient_name="Tomato"),
        ]
        new_cats = [(0, members, members[0])]

        await category_matcher_no_openai._name_and_persist_categories(
            new_cats, category_repo
        )

        mock_session.add.assert_called_once()
        created = mock_session.add.call_args[0][0]
        assert created.category_name == "Ingredient Group 0"

    async def test_empty_list_returns_early(
        self, category_matcher, category_repo, mock_session
    ):
        await category_matcher._name_and_persist_categories([], category_repo)
        mock_session.add.assert_not_called()


class TestGenerateClusterNames:
    async def test_with_openai_client(
        self,
        category_matcher,
        mock_openai_client,
        make_ingredient,
    ):
        members = [
            make_ingredient(ingredient_name="Tomato"),
            make_ingredient(ingredient_name="Onion"),
        ]
        new_cats = [(0, members, members[0])]

        result = await category_matcher._generate_cluster_names(new_cats)

        assert result == {0: "Vegetables"}
        mock_openai_client.chat.completions.create.assert_called_once()

    async def test_without_openai_client_uses_fallback(
        self,
        category_matcher_no_openai,
        make_ingredient,
    ):
        members = [
            make_ingredient(ingredient_name="Tomato"),
        ]
        new_cats = [(1, members, members[0])]

        result = await category_matcher_no_openai._generate_cluster_names(new_cats)

        assert result == {1: "Ingredient Group 1"}

    async def test_invalid_json_from_llm_falls_back(
        self,
        category_matcher,
        mock_openai_client,
        make_ingredient,
    ):
        mock_openai_client.chat.completions.create.return_value.choices[
            0
        ].message.content = "not valid json"
        members = [make_ingredient(ingredient_name="Test")]
        new_cats = [(0, members, members[0])]

        result = await category_matcher._generate_cluster_names(new_cats)

        assert result == {0: "Ingredient Group 0"}

    async def test_missing_key_in_llm_response_falls_back(
        self,
        category_matcher,
        mock_openai_client,
        make_ingredient,
    ):
        mock_openai_client.chat.completions.create.return_value.choices[
            0
        ].message.content = '{"1": "Spices"}'
        members = [make_ingredient(ingredient_name="Salt")]
        new_cats = [(0, members, members[0])]

        result = await category_matcher._generate_cluster_names(new_cats)

        assert result == {0: "Ingredient Group 0"}

    async def test_none_content_raises_value_error(
        self,
        category_matcher,
        mock_openai_client,
        make_ingredient,
    ):
        mock_openai_client.chat.completions.create.return_value.choices[
            0
        ].message.content = None
        members = [make_ingredient(ingredient_name="Test")]
        new_cats = [(0, members, members[0])]

        with pytest.raises(ValueError, match="empty response"):
            await category_matcher._generate_cluster_names(new_cats)


class TestPersistAssignments:
    async def test_empty_assignments_skips_bulk_update(
        self, category_matcher, ingredient_repo, mock_session
    ):
        ingredient_repo.bulk_update_categories = AsyncMock()
        await category_matcher._persist_assignments({}, ingredient_repo)
        ingredient_repo.bulk_update_categories.assert_not_called()

    async def test_delegates_to_bulk_update(self, category_matcher, ingredient_repo):
        ing_id, cat_id = uuid4(), uuid4()
        ingredient_repo.bulk_update_categories = AsyncMock()
        await category_matcher._persist_assignments({ing_id: cat_id}, ingredient_repo)

        ingredient_repo.bulk_update_categories.assert_called_once_with(
            [(ing_id, cat_id)]
        )


class TestFullCategorizeFlow:
    async def test_phase1_matches_by_name_then_stops(
        self, category_matcher, ingredient_repo, category_repo, make_ingredient
    ):
        cat_id = uuid4()
        single_ingredient = make_ingredient(
            ingredient_name="tomato", normalized_name="tomato", category_id=None
        )
        ingredient_repo.get_uncategorized = AsyncMock(return_value=[single_ingredient])
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock(
            return_value=[
                RecipeIngredient(
                    id=uuid4(),
                    recipe_id=uuid4(),
                    ingredient_name="tomato",
                    normalized_name="tomato",
                    category_id=cat_id,
                ),
            ]
        )
        ingredient_repo.bulk_update_categories = AsyncMock()
        ingredient_repo.get_centroids = AsyncMock()

        await category_matcher._run(ingredient_repo, category_repo)

        ingredient_repo.get_centroids.assert_not_called()

    async def test_phase2_matches_by_centroid_then_stops(
        self,
        category_matcher,
        ingredient_repo,
        category_repo,
        uncategorized_ingredients,
    ):
        cat_id = uuid4()
        ingredient_repo.get_uncategorized = AsyncMock(
            return_value=uncategorized_ingredients
        )
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock(return_value=[])
        ingredient_repo.get_centroids = AsyncMock(
            return_value=[
                RecipeIngredient(
                    id=uuid4(),
                    recipe_id=uuid4(),
                    ingredient_name="tomato_centroid",
                    normalized_name="tomato_centroid",
                    embedding=[0.5, 0.5, 0.5],
                    category_id=cat_id,
                ),
            ]
        )
        ingredient_repo.bulk_update_categories = AsyncMock()
        category_repo.get_all = AsyncMock()

        await category_matcher._run(ingredient_repo, category_repo)

        category_repo.get_all.assert_not_called()

    async def test_phase3_clusters_when_no_centroid_match(
        self, category_matcher, ingredient_repo, category_repo, make_ingredient
    ):
        ingredients = [
            make_ingredient(
                ingredient_name="novel_a",
                normalized_name="novel_a",
                embedding=[0.5, 0.5, 0.5],
                category_id=None,
            ),
            make_ingredient(
                ingredient_name="novel_b",
                normalized_name="novel_b",
                embedding=[0.51, 0.49, 0.5],
                category_id=None,
            ),
        ]
        ingredient_repo.get_uncategorized = AsyncMock(return_value=ingredients)
        ingredient_repo.get_categorized_by_normalized_names = AsyncMock(return_value=[])
        ingredient_repo.get_centroids = AsyncMock(return_value=[])
        category_repo.get_all = AsyncMock(return_value=[])
        ingredient_repo.bulk_update_categories = AsyncMock()
        category_repo.create = AsyncMock(
            return_value=IngredientCategory(
                id=uuid4(), category_name="New Group", centroid_id=ingredients[0].id
            )
        )

        await category_matcher._run(ingredient_repo, category_repo)

        category_repo.create.assert_called_once()


class TestConfigConstants:
    def test_centroid_match_threshold_is_reasonable(self):
        assert 0.0 < CENTROID_MATCH_NEW_INGREDIENTS_COSINE_SIMILARITY < 1.0

    def test_centroid_merge_threshold_is_reasonable(self):
        assert 0.0 < CENTROID_MERGE_CLUSTER_COSINE_SIMILARITY < 1.0

    def test_agglomerative_threshold_is_reasonable(self):
        assert 0.0 < AGGLOMERATIVE_DISTANCE_THRESHOLD < 1.0

    def test_merge_threshold_higher_than_match_threshold(self):
        assert (
            CENTROID_MERGE_CLUSTER_COSINE_SIMILARITY
            > CENTROID_MATCH_NEW_INGREDIENTS_COSINE_SIMILARITY
        )
