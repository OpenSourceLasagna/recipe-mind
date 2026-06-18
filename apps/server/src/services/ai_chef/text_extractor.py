class TextExtractor:
    def __init__(self, target_key: str) -> None:
        self._target_key = target_key
        self._buffer = ""
        self._state = "searching_key"
        self._extracted = ""
        self._done = False

    def feed(self, chunk: str) -> str:
        if self._done:
            return ""

        self._buffer += chunk
        result = ""

        while self._buffer and not self._done:
            prev_len = len(self._buffer)
            prev_state = self._state

            if self._state == "searching_key":
                if not self._try_find_key():
                    break
            elif self._state == "expecting_colon":
                if not self._try_skip_colon():
                    break
            elif self._state == "expecting_value":
                if not self._try_start_value():
                    break
            elif self._state == "reading_string":
                extracted, complete = self._read_string()
                result += extracted
                if complete:
                    self._done = True

            if len(self._buffer) == prev_len and self._state == prev_state:
                break

        return result

    def _try_find_key(self) -> bool:
        search = f'"{self._target_key}"'
        idx = self._buffer.find(search)

        if idx == -1:
            keep = min(len(self._buffer), len(search) - 1)
            if keep < len(self._buffer):
                self._buffer = (
                    self._buffer[len(self._buffer) - keep :] if keep > 0 else ""
                )
            return False

        after_key = idx + len(search)
        if after_key < len(self._buffer):
            next_char = self._buffer[after_key]
            if next_char not in ": \t\n\r":
                self._buffer = self._buffer[idx + 1 :]
                return False

        self._buffer = self._buffer[after_key:]
        self._state = "expecting_colon"
        return True

    def _try_skip_colon(self) -> bool:
        i = 0
        while i < len(self._buffer):
            c = self._buffer[i]
            if c in " \t\n\r":
                i += 1
            elif c == ":":
                self._buffer = self._buffer[i + 1 :]
                self._state = "expecting_value"
                return True
            else:
                self._state = "searching_key"
                return False
        self._buffer = ""
        return False

    def _try_start_value(self) -> bool:
        i = 0
        while i < len(self._buffer):
            c = self._buffer[i]
            if c in " \t\n\r":
                i += 1
            elif c == '"':
                self._buffer = self._buffer[i + 1 :]
                self._state = "reading_string"
                return True
            elif c == "n":
                if self._buffer[i:].startswith("null"):
                    self._done = True
                    return True
                self._state = "searching_key"
                return True
            else:
                self._done = True
                return True

        self._buffer = ""
        return False

    def _read_string(self) -> tuple[str, bool]:
        result = []
        i = 0

        while i < len(self._buffer):
            c = self._buffer[i]

            if c == "\\":
                if i + 1 >= len(self._buffer):
                    self._buffer = self._buffer[i:]
                    return "".join(result), False

                next_c = self._buffer[i + 1]

                if next_c == "u":
                    if i + 5 >= len(self._buffer):
                        self._buffer = self._buffer[i:]
                        return "".join(result), False
                    hex_str = self._buffer[i + 2 : i + 6]
                    if len(hex_str) < 4:
                        self._buffer = self._buffer[i:]
                        return "".join(result), False
                    try:
                        code_point = int(hex_str, 16)
                        result.append(chr(code_point))
                    except ValueError:
                        result.append("\\u" + hex_str)
                    i += 6
                else:
                    escape_map = {
                        '"': '"',
                        "\\": "\\",
                        "/": "/",
                        "n": "\n",
                        "t": "\t",
                        "r": "\r",
                        "b": "\b",
                        "f": "\f",
                    }
                    result.append(escape_map.get(next_c, next_c))
                    i += 2

            elif c == '"':
                self._buffer = self._buffer[i + 1 :]
                return "".join(result), True

            else:
                result.append(c)
                i += 1

        self._buffer = ""
        return "".join(result), False
