# Local AI Control Center

Een lokale werkruimte om met Ollama-modellen te chatten en hun antwoorden te vergelijken. De interface is gebouwd met React, Vite en TypeScript; de API gebruikt FastAPI en SQLite. Prompts en opgeslagen gesprekken blijven op je eigen computer.

> Lees je liever Engels? Ga naar de [Engelstalige README](README.en.md).

## Benodigdheden

- Python 3.11 of nieuwer
- [uv](https://docs.astral.sh/uv/)
- Node.js 20.19+ of 22.12+
- [Ollama](https://ollama.com/download), lokaal geïnstalleerd

## Starten na een nieuwe kloon

Open twee terminals in de hoofdmap van de repository.

### 1. Start Ollama en installeer een model

Ollama draait meestal als achtergrondservice. Start het zo nodig in een terminal:

```sh
ollama serve
```

Installeer in een andere terminal een model, bijvoorbeeld:

```sh
ollama pull qwen2.5:7b
```

Ollama beheert modeldownloads. Het dashboard downloadt of verwijdert geen modellen.

### 2. Start de API

```sh
cd backend
uv sync
uv run python -m app
```

De API luistert standaard op `127.0.0.1:8000`. Pas het bindadres of de poort aan met `LACC_HOST` of `LACC_PORT` in het `.env`-bestand in de hoofdmap. De SQLite-database wordt bij de eerste start aangemaakt in `backend/data/`.

### 3. Start de frontend

Open een tweede terminal in de hoofdmap:

```sh
cd frontend
npm ci
npm run dev
```

Open de lokale URL die Vite toont, meestal <http://127.0.0.1:5173>. De Vite-ontwikkelserver stuurt `/api`-verzoeken door naar de FastAPI-server. Als poort 5173 bezet is, kiest Vite mogelijk automatisch een andere poort; gebruik dan de URL uit de terminal.

## Instellingen

Standaard gebruikt de app Ollama op `http://127.0.0.1:11434`, slaat SQLite-gegevens op in `backend/data/local-ai-control-center.db` en bindt de API aan localhost. Optionele instellingen gebruiken het voorvoegsel `LACC_`:

| Variabele | Standaardwaarde | Doel |
| --- | --- | --- |
| `LACC_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Adres van de Ollama HTTP-API |
| `LACC_DATABASE_URL` | `sqlite:///./data/local-ai-control-center.db` | Pad naar de SQLite-database (relatief aan `backend/`) |
| `LACC_HOST` | `127.0.0.1` | Bindadres van de API |
| `LACC_PORT` | `8000` | API-poort |
| `LACC_REQUEST_TIMEOUT_SECONDS` | `10` | Time-out voor verbindingen en verzoeken aan Ollama; het lezen van antwoorden mag maximaal 5 minuten duren |

Kopieer `.env.example` naar `.env` in de hoofdmap om instellingen aan te passen. Start de API vanuit `backend/`, zodat het relatieve pad naar de database uitkomt op `backend/data/`. De CORS-toestaanlijst van de API is beperkt tot lokale Vite-ontwikkeladressen.

De Vite-proxy voor `/api` gebruikt standaard `http://127.0.0.1:8000`. Draait de API op een andere poort, stel dan `VITE_API_TARGET` in voordat je Vite start. Bijvoorbeeld in PowerShell:

```powershell
$env:VITE_API_TARGET = 'http://127.0.0.1:18080'
```

## Functies

- Status van de Ollama-verbinding en geïnstalleerde modellen
- Chatten met streaming, met gesprekken en berichten opgeslagen in SQLite
- Gesprekken zoeken, hernoemen en verwijderen
- Generatieduur, promptduur, aantal tokens en tokens per seconde wanneer Ollama die gegevens levert
- Prompt-speeltuin om één prompt parallel met twee tot vier lokale modellen uit te voeren
- Responsieve donkere interface met laad-, lege en foutstatussen
- Engelse en Nederlandse interface; de gekozen taal wordt lokaal onthouden

## Ontwikkelcontroles

De backendtests gebruiken nagebootste Ollama-antwoorden; er hoeft geen Ollama-instantie actief te zijn:

```sh
cd backend
uv run python -m pytest
uv run python -m ruff check app tests
```

Controleer en bouw de frontend:

```sh
cd frontend
npm ci
npm run format:check
npm run build
```

## Beveiliging en lokaal gebruik

- Houd de API en frontend voor lokaal gebruik gebonden aan `127.0.0.1`. Stel ze niet bloot aan een netwerk zonder eerst authenticatie toe te voegen en CORS en toegangsbeheer te controleren.
- Het Ollama-adres is instelbaar voor lokale configuraties; gebruik alleen een endpoint dat je vertrouwt.
- De API heeft geen authenticatie, omdat deze bedoeld is voor lokaal gebruik. Iedereen met toegang tot de lokale service kan die gebruiken.
- Prompts, berichten en gesprekstitels worden opgeslagen in de lokale SQLite-database. De database wordt uitgesloten van versiebeheer.
- De lengte van chatinvoer en prompts is begrensd. Verzoeken aan Ollama hebben time-outs; lange generaties kunnen alsnog mislukken of worden geannuleerd.
- De Prompt-speeltuin accepteert alleen modellen die door de ingestelde Ollama-service als geïnstalleerd worden gemeld. Modellen worden niet gedownload of verwijderd.

## Projectstructuur

```text
backend/    FastAPI-API, Ollama-client, SQLite-schema en pytest-tests
            pyproject.toml en uv.lock beheren de Python-omgeving
frontend/   React- en Vite-applicatie
```
