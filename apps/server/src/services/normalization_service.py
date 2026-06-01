from nltk.stem import WordNetLemmatizer # type: ignore

class NormalizationService:
    def __init__(self):
        self.lemmatizer = WordNetLemmatizer() # type: ignore

    def normalize_word(self, word: str) -> str:
        word = word.strip().lower()
        return self.lemmatizer.lemmatize(word) # type: ignore

