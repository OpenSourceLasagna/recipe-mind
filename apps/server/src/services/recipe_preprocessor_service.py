
from ..models.recipe import Recipe

class RecipePreprocessorService:
    """
    Transforms the specific recipe data model into a semantically rich 
    Markdown document tailored for natural language text embedding models.
    """

    def to_markdown(self, recipe: Recipe) -> str:
        markdown_parts = [f"# Recipe: {recipe.title.strip()}"]

        profile_sentence = f"This is a {recipe.difficulty.strip()} difficulty dish"
        if recipe.origin and recipe.origin.strip().lower() != "unknown":
            profile_sentence += f" with origins in {recipe.origin.strip()} cuisine"
        profile_sentence += "."
        markdown_parts.append(profile_sentence)

        specs: list[str] = []
        if recipe.duration_minutes > 0:
            specs.append(f"Takes approximately {recipe.duration_minutes} minutes to prepare and cook.")
        specs.append(f"Makes {recipe.servings} servings.")
        specs.append(f"Spiciness level: {recipe.spice_level} out of 5.")
        markdown_parts.append(" ".join(specs))

        if recipe.nutrition:
            nutrition_items = [
                f"{key.replace('_', ' ').capitalize()}: {val}"
                for key, val in recipe.nutrition.items()
                if val is not None
            ]
            if nutrition_items:
                markdown_parts.append("Nutritional Information:\n" + ". ".join(nutrition_items) + ".")

        if recipe.additional_information:
            clean_info = [info.strip() for info in recipe.additional_information if info.strip()]
            if clean_info:
                markdown_parts.append("Additional Details and Attributes:\n* " + "\n* ".join(clean_info))

        if recipe.instruction_steps:
            clean_steps = [step.strip() for step in recipe.instruction_steps if step.strip()]
            if clean_steps:
                steps_formatted = [f"Step {i+1}: {step}" for i, step in enumerate(clean_steps)]
                markdown_parts.append("Cooking Instructions:\n" + "\n".join(steps_formatted))

        return "\n\n".join(markdown_parts)