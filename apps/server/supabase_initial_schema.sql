-- ===========================
-- Enable pgvector extension
-- ===========================
CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================
-- Create recipes table
-- ===========================
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    additional_information TEXT[] DEFAULT '{}',
    instruction_steps TEXT[] DEFAULT '{}',
    nutrition JSONB DEFAULT '{}',
    servings INTEGER DEFAULT 4,
    duration_minutes INTEGER DEFAULT 0,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    spice_level INTEGER CHECK (spice_level >= 1 AND spice_level <= 5) DEFAULT 2,
    origin TEXT DEFAULT 'Unknown',
    is_public BOOLEAN DEFAULT FALSE,
    embedding vector(1536),
    raw_source TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_spice_level ON recipes(spice_level);
CREATE INDEX IF NOT EXISTS idx_recipes_duration ON recipes(duration_minutes);

CREATE INDEX IF NOT EXISTS idx_recipes_only_public ON recipes(id) WHERE is_public = TRUE;

-- over 1_000_000 recipes use lists = sqrt(rows), below rows / 1000
CREATE INDEX IF NOT EXISTS idx_recipes_embedding ON recipes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);


-- ===========================
-- Create ingredient_categories table
-- ===========================
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes

CREATE INDEX IF NOT EXISTS idx_ingredient_categories_name ON ingredient_categories(category_name);

-- ===========================
-- Create recipe_ingredients table
-- ===========================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    category_id UUID REFERENCES ingredient_categories(id) ON DELETE SET NULL,
    ingredient_name TEXT NOT NULL,
    quantity FLOAT DEFAULT 1.0,
    unit TEXT DEFAULT '',
    embedding vector(384), --BAAI/bge-small-en-v1.5
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_name ON recipe_ingredients(ingredient_name);


-- ===========================
-- Create diet_tags table
-- ===========================
CREATE TABLE IF NOT EXISTS diet_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()  
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_diet_tags_recipe_id ON diet_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_diet_tags_name ON diet_tags(tag_name);


-- ===========================
-- POLICIES
-- ===========================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

ALTER TABLE ingredient_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE diet_tags ENABLE ROW LEVEL SECURITY;

-- recipes
CREATE POLICY recipes_select_policy ON recipes
    FOR SELECT USING ((auth.uid() = user_id) OR (is_public = TRUE));

CREATE POLICY recipes_insert_policy ON recipes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY recipes_update_policy ON recipes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY recipes_delete_policy ON recipes
    FOR DELETE USING (auth.uid() = user_id);


-- ingredients
CREATE POLICY recipe_ingredients_policy ON recipe_ingredients
    FOR ALL USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE user_id = auth.uid()
        )
    );

CREATE POLICY recipe_ingredients_select_policy ON recipe_ingredients
    FOR SELECT USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE is_public = TRUE --"FOR ALL" RULES ARE INHERITED
        )
    );

-- recipe categories
CREATE POLICY ingredient_categories_policy ON ingredient_categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipe_ingredients ri
            JOIN recipes r ON ri.recipe_id = r.id
            WHERE ri.category_id = ingredient_categories.id
            AND (r.user_id = auth.uid() OR r.is_public = TRUE)
        )
    );

-- diet tags
CREATE POLICY diet_tags_policy ON diet_tags
    FOR ALL USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE user_id = auth.uid()
        )
    );

CREATE POLICY diet_tags_select_policy ON diet_tags
    FOR SELECT USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE is_public = TRUE --"FOR ALL" RULES ARE INHERITED
        )
    );  

-- ===========================
-- Create updated_at trigger
-- ===========================
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recipes_updated_at
BEFORE UPDATE ON recipes
FOR EACH ROW
EXECUTE FUNCTION update_recipes_updated_at();