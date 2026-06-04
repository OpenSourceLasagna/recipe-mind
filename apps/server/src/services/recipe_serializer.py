
from ..models.recipe import Recipe

class RecipeSerializerService:

    @staticmethod
    def to_vector_markdown(recipe: "Recipe") -> str:
        """
        Optimized for dense embeddings.
        Creates an ultra-focused keyword footprint so queries like 'toma' or 'smoo'
        score highly without being diluted by paragraphs of text.
        """
        title_clean = recipe.title.strip()
        markdown_parts = [f"# {title_clean}"]
        
        ingredient_terms: set[str] = set()
        
        if recipe.ingredients:
            for ri in recipe.ingredients:
                if ri.ingredient_name:
                    ingredient_terms.add(ri.ingredient_name.strip().lower())
                if ri.normalized_name:
                    ingredient_terms.add(ri.normalized_name.strip().lower())

        keywords = [title_clean.lower()]
        if recipe.origin and recipe.origin.lower() != "unknown":
            keywords.append(recipe.origin.strip().lower())
        keywords.append(recipe.difficulty.strip().lower())
        
        keywords.extend(list(ingredient_terms))
        
        markdown_parts.append(f"Keywords: {', '.join(keywords)}")
        
        return "\n\n".join(markdown_parts)

    @staticmethod
    def to_rerank_markdown(recipe: "Recipe") -> str:
        """
        Optimized for Cross-Encoder Evaluation.
        Provides a complete, human-readable structural snapshot of the entire document
        so the reranker can perform fine-grained comparisons.
        """
        markdown_parts = [f"# Recipe: {recipe.title.strip()}"]
        
        markdown_parts.append(
            f"Attributes: Difficulty={recipe.difficulty}, "
            f"Origin={recipe.origin}, "
            f"Duration={recipe.duration_minutes}m, "
            f"Servings={recipe.servings}, "
            f"Spice={recipe.spice_level}/5"
        )
        
        if recipe.ingredients:
            ing_list: list[str] = []
            for ri in recipe.ingredients:
                qty = ri.quantity
                unit_str = f" {ri.unit.strip()}" if ri.unit else ""
                name = ri.ingredient_name.strip()
                
                ing_list.append(f"* {qty}{unit_str} {name}")
                
            if ing_list:
                markdown_parts.append("Ingredients:\n" + "\n".join(ing_list))

        if recipe.instruction_steps:
            clean_steps = [step.strip() for step in recipe.instruction_steps if step.strip()]
            if clean_steps:
                steps_formatted = [f"Step {i+1}: {step}" for i, step in enumerate(clean_steps)]
                markdown_parts.append("Cooking Instructions:\n" + "\n".join(steps_formatted))

        return "\n\n".join(markdown_parts)