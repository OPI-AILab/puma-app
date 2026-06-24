# PUMA (Polish Unified Multimodal Assessment)

PUMA to aplikacja do automatyzacji, zarządzania oraz ewaluacji modeli sztucznej inteligencji, skupiająca się na ocenie kompetencji językowych i kulturowych w kontekście wybranego języka.
Aplikacja wspiera dziewięć języków: polski, angielski, niemiecki, francuski, niderlandzki, portugalski, hiszpański, włoski i rosyjski, ale może być w łatwy sposób rozszerzona do obsługi kolejnych.
Ocena ta przebiega na podstawie opracowanych reguł walidacyjnych oraz zadań podzielonych na kilka modalności: obrazy, dźwięki, wideo i dokumenty. Każda z nich zawiera kategorie skupiając się na określonym obszarze wiedzy lub kompetencji. 
I tak, dla obrazu wyróżniamy kategorie: historie i kultura, życie współczesne, geografia i środowisko. 
Dla dźwięków: automatyczne rozpoznawanie mowy (ASR), pytania dotyczące mowy (SpeechQA) oraz pytania dotyczące muzyki i dźwięku (Sound and music QA). 
Dla dokumentów: optyczne rozpoznawanie znaków (OCR), pytania dotyczące dokumentów (Document QA), ekstrakcja danych z dokumentów (Structured extraction).
Filmy są reprezentowane przez kategorię Video QA.
---

## 1. Główne Funkcje Systemu
System pozwała w pełni zarządzać procesem ewaluacji modeli. Do najważniejszych funkcji należą:
* **Zarządzanie Zadaniami (Tasks):** Umożliwia tworzenie datasetów przypisanych do kategorii z możliwością ich edycji, wyszukiwania oraz podglądu.
* **Wielojęzyczność:** System umożliwia tworzenie osobnych datasetów dla każdego z dostępnych języków dzięki budowanej bazie ustrukturyzowanych promptów systemowych dla języków: polskiego (pl), angielskiego (en), niemieckiego (de), francuskiego (fr), holenderskiego (nl), portugalskiego (pt), hiszpańskiego (es), włoskiego (it) oraz rosyjskiego (ru). Opracowane prompty wymuszają czysty format wyjściowy (np. liczby zapisane słownie w ASR, tabele w HTML w OCR) bez zbędnych komentarzy modelu.
* **Automatyczna Walidacja Reguł:** Dynamiczna weryfikacja warunków sukcesu (Verification Conditions) na poziomie backendu, dostosowana do specyfiki wybranej kategorii zadania.
* **Ewaluacja Asynchroniczna:** Silnik odpowiedzialny za masowe uruchamianie testów odpowiada za monitorowanie ich stanu na żywo, możliwość przerywania zadań oraz dynamiczną zmianę konfiguracji parametrów modelu w locie.
* **Analiza i Import Logów:** System zawiera moduł pozwalający na importowanie zewnętrznych logów produkcyjnych w formacie `.jsonl`, ich przeglądanie oraz szczegółową inspekcję błędów.
* **Eksport Środowiska:** System umożliwia pobranie całego projektu (bazy danych wraz z wgranymi plikami) w formie jednego archiwum ZIP za pomocą dedykowanego endpointu API.
* **Administracja i Bezpieczeństwo:** 
  * Autoryzacja oparta o tokeny JWT zapisywane w bezpiecznych ciasteczkach.
  * Panel administracyjny umożliwiający zarządzanie użytkownikami.
  * System automatycznych, harmonogramowanych kopii zapasowych (Backup Scheduler).

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
* `--migration_script` (str): Ścieżka do pliku migracyjnego zawierającego niezbędne instrukcje SQL (domyślnie: `migrations.json`).
* `--prompts_file` (str): Ścieżka do pliku konfiguracyjnego z promptami systemowymi (domyślnie: `prompts.json`).
* `--log_sql` (bool): Flaga włączająca pełne logowanie zapytań SQL generowanych przez ORM (domyślnie: `False`).

---

## 4. Instrukcja Użytkownika 

### 4.1. Pierwsze uruchomienie i inicjalizacja systemu
Przy pierwszym uruchomieniu system sprawdza bazę danych pod kątem zarejestrowanych użytkowników. Jeśli baza jest pusta, aplikacja przechodzi w tryb inicjalizacji:
1. Otwórz aplikację w przeglądarce. Zostaniesz poproszony o zdefiniowanie hasła dla domyślnego konta administratora (`admin`).
2. Hasło musi składać się z **co najmniej 8 znaków**.
3. Po pomyślnym utworzeniu konta administratora, endpoint inicjalizacyjny zostaje trwale zablokowany, chroniąc system przed ponownym nadpisaniem właściciela.

### 4.2. Logowanie
* Logowanie odbywa się poprzez podanie nazwy użytkownika i hasła.
* Po poprawnej weryfikacji serwer generuje token JWT i osadza go w przeglądarce w ciasteczku o nazwie `access_token`.
* Wylogowanie czyści token sesyjny po stronie serwera i usuwa ciasteczko z przeglądarki.

### 4.3. Zarządzanie zadaniami ewaluacyjnymi (Tasks)
1. Strona główna systemu zawiera moduł zarządzający taskami.
2. Zaznacz wybraną kategorie tasków aby odblokować przycisk "Add task" umożliwiający przejście do panelu dodawania nowego zadania
3. Zdefiniuj **Warunki Weryfikacji (Verification Conditions)**. System automatycznie zwaliduje, czy dodane reguły sprawdzające są zgodne z mapą dozwolonych typów dla danej kategorii.
4. Wgraj powiązany plik testowy (np. próbkę audio dla ASR lub plik graficzny/PDF dla OCR). Wszystkie pliki są bezpiecznie składowane w podkatalogu `files` wewnątrz wskazanego katalogu projektu (np. `_project/files/`). Możesz opcjonalnie podać adres źródłowy URL, licencję oraz informacje o autorze pliku (attribution).

### 4.4. Konfiguracja modelu 
1. W sekcji **Models** możesz zarejestrować parametry techniczne modelu (np. nazwa, temperatura, maksymalna liczba tokenów, klucze API itp.).
2. Zapisanie lub modyfikacja modelu automatycznie odświeża stan komponentu oceniającego.
3. System blokuje możliwość usunięcia modelu, jeśli jest on powiązany z zapisanymi w bazie odpowiedziami lub aktywnymi procesami.

### 4.5. Statystyki
* Sekcja statystyki zawiera zestawienie podsumujące aktywność wszystkich użytkowników
* Przedstawia sumę wszystkich tasków jakie użytkownik wprowadził na przestrzeni kolejnych tygodni

### 4.6. Ewaluacje
1. Sekcja **Evaluations** zawiera zestawienie ewaluacja z możliwością ponownego przeliczenia danej ewaluacji, podglądu oraz opcji usunięcia. Zawiera informacje o statusie, postępie, wyniku procentowym oraz dacie wykonania ewaluacji
2. Nową konfiguracje definiujemy klikając **Create Evaluation**, definiując nazwę, docelową konfigurację modelu oraz kategorie zadań.
2. Przycisk **Start** rozpocznie asynchroniczny proces testowy. Koordynator procesu (`EvaluationRunner`) będzie po kolei przekazywał zadania do modeli i weryfikował odpowiedzi na podstawie instrukcji z wybranego języka (np. polskie instrukcje pobierane z pliku `prompts.json`).
3. Można na bieżąco monitorować postęp lub przerwać proces przyciskiem **Cancel**.
4. Jeśli konfiguracja testu wymaga poprawek, edycja parametrów modelu jest dozwolona wyłącznie wtedy, gdy ewaluacja znajduje się w stanie nieaktywnym (status *inactive*).
5. W przypadku wystąpienia błędu krytycznego podczas przetwarzania danego zadania, jego identyfikator zostanie zapisany w bazie danych w kolumnie `error_task_id` ułatwiając szybką diagnozę problemu.

### 4.7. Importowanie i przeglądanie Logów
1. Sekcję  **Import Logs** umożliwia przeglądanie i analizowanie logów z ewaluacji modeli.
2. Prześlij plik z rozszerzeniem `.jsonl`. Każda linia pliku musi być poprawnym, niezależnym obiektem JSON.
3. Po udanym imporcie system przydzieli unikalny identyfikator importu (`import_id`) i generowane jest indywidualne zestawienie z unikalnym URLem. Logi można przeglądać w ustrukturyzowanej formie za pomocą stronicowanej tabeli.

### 4.8. Panel administracyjny
* Panel administracyjny zawiera trzy sekcje w których
1. Ustawia się domyślny język dla którego dodawane są bieżące taski
2. Udostępnia opcje wyszukiwanie tzw. osieroconych plików czyli nieprzypisanaych do żadnych tasków, a następnie umożliwia ich usunięcie
3. Zarządza kontami użytkowników, umożliwia ich dodawanie oraz nadanie domyślnego hasła do konta

### 4.9. Eksport Całego Projektu
* W dowolnym momencie zalogowany użytkownik może pobrać kompletny stan środowiska roboczego. Wywołanie akcji eksportu generuje w locie archiwum ZIP zawierające aktualną bazę danych oraz wszystkie powiązane pliki i przesyła je bezpośrednio do przeglądarki jako plik `export.zip`.
