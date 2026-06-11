# Platforma Ujednoliconej Ewaluacji Modeli Autonomicznych (PUMA)

PUMA to zaawansowany system typu klient-serwer przeznaczony do automatyzacji, zarządzania oraz jakościowej i ilościowej ewaluacji modeli sztucznej inteligencji (LLM oraz modeli specjalizowanych). Aplikacja obsługuje trzy główne scenariusze przetwarzania danych: automatyczne rozpoznawanie mowy (ASR), optyczne rozpoznawanie znaków (OCR) oraz ustrukturyzowaną ekstrakcję danych biznesowych.

---

## 1. Główne Funkcje Systemu

* **Zarządzanie Zadaniami (Tasks):** Tworzenie zestawów testowych (datasetów) przypisanych do kategorii takich jak `ASR`, `OCR` lub `Structured extraction`.
* **Automatyczna Walidacja Reguł:** Dynamiczna weryfikacja warunków sukcesu (Verification Conditions) na poziomie backendu, dostosowana do specyfiki wybranej kategorii zadania.
* **Wielojęzyczność:** Wbudowana baza ustrukturyzowanych promptów systemowych dla języków: polskiego (pl), angielskiego (en), niemieckiego (de), francuskiego (fr), holenderskiego (nl), portugalskiego (pt), hiszpańskiego (es), włoskiego (it) oraz rosyjskiego (ru). Prompty wymuszają czysty format wyjściowy (np. liczby zapisane słownie w ASR, tabele w HTML w OCR) bez zbędnych komentarzy modelu.
* **Ewaluacja Asynchroniczna (Evaluation Runner):** Silnik odpowiedzialny za masowe uruchamianie testów, monitorowanie ich stanu na żywo, możliwość przerywania zadań oraz dynamiczną zmianę konfiguracji parametrów modelu w locie.
* **Analiza i Import Logów:** Moduł pozwalający na importowanie zewnętrznych logów produkcyjnych w formacie `.jsonl` (JSON Lines), ich stronicowane przeglądanie oraz szczegółową inspekcję błędów.
* **Administracja i Bezpieczeństwo:** 
  * Autoryzacja oparta o tokeny JWT zapisywane w bezpiecznych ciasteczkach (`HttpOnly`, `SameSite=Strict`).
  * Panel administracyjny umożliwiający zarządzanie użytkownikami (RBAC) oraz zmianę domyślnego języka systemu.
  * System automatycznych, harmonogramowanych kopii zapasowych (Backup Scheduler).
* **Eksport Środowiska:** Możliwość pobrania całego projektu (bazy danych wraz z wgranymi plikami) w formie jednego archiwum ZIP za pomocą dedykowanego endpointu API.

---

## 2. Architektura i Stos Technologiczny

* **Backend:** FastAPI (Python), SQLModel / SQLAlchemy, Uvicorn, Python-Jose (JWT), Passlib/Bcrypt.
* **Frontend:** Angular (TypeScript), TailwindCSS / PostCSS.
* **Baza danych i przechowywanie:** SQLite/SQLAlchemy do struktury danych, lokalny system plików dla załączników.

---

## 3. Instalacja i Uruchomienie

### Wymagania Wstępne
* Python 3.11 lub nowszy
* Node.js & npm 

### Instalacja i Konfiguracja Środowiska Backendowego
1. Sklonuj repozytorium projektu.
2. Zainstaluj wymagane zależności wymienione w pliku `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
3. Przed pierwszym uruchomieniem upewnij się, że pliki migracyjne (np. `migrations.sql`) oraz baza promptów (`prompts.json`) znajdują się w głównym katalogu roboczym.

### Uruchomienie Serwera Aplikacji
Aplikacja jest uruchamiana za pomocą skryptu startowego `run_server.py`. Możesz dostosować jej działanie za pomocą flag wiersza poleceń:

```bash
python run_server.py --host 0.0.0.0 --port 8080 --project_dir _project --prompts_file prompts.json
```

**Dostępne parametry konfiguracyjne (CLI):**
* `--host` (str): Adres IP, na którym serwer będzie nasłuchiwał (domyślnie: `0.0.0.0`).
* `--port` (int): Port sieciowy serwera (domyślnie: `8080`).
* `--project_dir` (str): Ścieżka do katalogu projektu, w którym przechowywana będzie baza danych SQLite oraz wgrane pliki (domyślnie: `_project`).
* `--jwt_secret` (str): Klucz prywatny używany do podpisywania tokenów sesyjnych JWT.
* `--prompts_file` (str): Ścieżka do pliku konfiguracyjnego z promptami systemowymi (domyślnie: `prompts.json`).
* `--log_sql` (bool): Flaga włączająca pełne logowanie zapytań SQL generowanych przez ORM (domyślnie: `False`).

---

## 4. Instrukcja Użytkownika i Przepływ Pracy

### 4.1. Pierwsze Uruchomienie i Inicjalizacja Systemu
Przy pierwszym uruchomieniu system sprawdza bazę danych pod kątem zarejestrowanych użytkowników. Jeśli baza jest pusta, aplikacja przechodzi w tryb inicjalizacji:
1. Otwórz aplikację w przeglądarce. Zostaniesz poproszony o zdefiniowanie hasła dla domyślnego konta administratora (`admin`).
2. Hasło musi składać się z **co najmniej 8 znaków**.
3. Po pomyślnym utworzeniu konta administratora, endpoint inicjalizacyjny zostaje trwale zablokowany, chroniąc system przed ponownym nadpisaniem właściciela.

### 4.2. Logowanie i Bezpieczeństwo Sesji
* Logowanie odbywa się poprzez podanie nazwy użytkownika i hasła.
* Po poprawnej weryfikacji serwer generuje token JWT i osadza go w przeglądarce w ciasteczku o nazwie `access_token`. Ciasteczko to posiada flagi zabezpieczające `HttpOnly` oraz `SameSite=Strict`, co uniemożliwia jego przechwycenie przez skrypty JavaScript (ochrona przed XSS).
* Wylogowanie czyści token sesyjny po stronie serwera i usuwa ciasteczko z przeglądarki.

### 4.3. Zarządzanie Zadaniami Ewaluacyjnymi (Tasks)
1. Przejdź do sekcji **Tasks** i wybierz opcję dodawania nowego zadania.
2. Przypisz zadanie do jednej z kategorii (`ASR`, `OCR`, `Structured extraction`).
3. Zdefiniuj **Warunki Weryfikacji (Verification Conditions)**. Backend automatycznie zwaliduje, czy dodane reguły sprawdzające są zgodne z mapą dozwolonych typów dla danej kategorii.
4. Wgraj powiązany plik testowy (np. próbkę audio dla ASR lub plik graficzny/PDF dla OCR). Wszystkie pliki są bezpiecznie składowane w podkatalogu `files` wewnątrz wskazanego katalogu projektu (np. `_project/files/`). Możesz opcjonalnie podać adres źródłowy URL, licencję oraz informacje o autorstwie (attribution).

### 4.4. Konfiguracja Modelu (Models)
1. W sekcji **Models** możesz zarejestrować parametry techniczne modelu sztucznej inteligencji (np. nazwa, temperatura, maksymalna liczba tokenów, klucze API itp.).
2. Zapisanie lub modyfikacja modelu automatycznie odświeża stan komponentu oceniającego (`TaskEvaluator`) na backendzie.
3. System blokuje możliwość usunięcia modelu, jeśli jest on powiązany z zapisanymi w bazie odpowiedziami lub aktywnymi procesami.

### 4.5. Przeprowadzanie Ewaluacji (Evaluations)
1. Przejdź do widoku **Evaluations** i wybierz **Create Evaluation**, definiując nazwę, docelową konfigurację modelu oraz kategorie zadań.
2. Kliknij **Start**, co uruchomi asynchroniczny proces testowy. Koordynator procesu (`EvaluationRunner`) będzie po kolei przekazywał zadania do modeli i weryfikował odpowiedzi na podstawie instrukcji z wybranego języka (np. polskie instrukcje pobierane z pliku `prompts.json`).
3. Możesz na bieżąco monitorować postęp lub przerwać proces przyciskiem **Cancel**.
4. Jeśli konfiguracja testu wymaga poprawek, edycja parametrów modelu jest dozwolona wyłącznie wtedy, gdy ewaluacja znajduje się w stanie nieaktywnym (status *inactive*).
5. W przypadku wystąpienia błędu krytycznego podczas przetwarzania danego zadania, jego identyfikator zostanie zapisany w bazie danych w kolumnie `error_task_id` ułatwiając szybką diagnozę problemu.

### 4.6. Importowanie i Przeglądanie Logów (Log Intelligence)
System umożliwia analizowanie zewnętrznych logów działania modeli:
1. Wybierz opcję **Import Logs** w menu logów.
2. Prześlij plik z rozszerzeniem `.jsonl`. Każda linia pliku musi być poprawnym, niezależnym obiektem JSON.
3. Po udanym imporcie system przydzieli unikalny identyfikator importu (`import_id`). Logi można przeglądać w ustrukturyzowanej formie za pomocą stronicowanej tabeli, wyszukiwać konkretne wpisy po ich ID oraz usuwać całe zaimportowane paczki danych.

### 4.7. Eksport Całego Projektu
W dowolnym momencie zalogowany użytkownik może pobrać kompletny stan środowiska roboczego. Wywołanie akcji eksportu generuje w locie archiwum ZIP zawierające aktualną bazę danych oraz wszystkie powiązane pliki i przesyła je bezpośrednio do przeglądarki jako plik `export.zip`.
