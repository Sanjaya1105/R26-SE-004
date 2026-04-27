# Cognitive Load API

## Permanent local run command

Use the project launcher from PowerShell:

```powershell
cd "E:\sliit projects\cognitive-load-api\COGNITIVE-LOAD-API"
.\start-api.ps1
```

The launcher uses `.venv\Scripts\python.exe -m uvicorn`, so it works even when the `uvicorn` command is not on your PATH.

To reinstall dependencies later:

```powershell
.\start-api.ps1 -Install
```

## Manual setup

If you want to run the commands yourself:

```powershell
cd "E:\sliit projects\cognitive-load-api\COGNITIVE-LOAD-API"
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8021
```

Important: use `app.main:app`, not only `app.main`. The `:app` part tells Uvicorn which FastAPI object to run.
