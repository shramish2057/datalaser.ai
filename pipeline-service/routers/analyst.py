from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional
import uuid
import json
import numpy as np
import pandas as pd
import io
import os
import httpx
from services.analyst import executor, analyst


def sanitize(obj):
    """Convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj

router = APIRouter()


def load_df(file_bytes: bytes, file_type: str) -> pd.DataFrame:
    buf = io.BytesIO(file_bytes)
    na_vals = ["", "null", "NULL", "NA", "N/A", "nan", "\\N"]
    if file_type == "csv":
        return pd.read_csv(buf, na_values=na_vals)
    elif file_type in ("xlsx", "xls"):
        return pd.read_excel(buf)
    elif file_type == "json":
        return pd.read_json(buf)
    elif file_type == "parquet":
        return pd.read_parquet(buf)
    raise ValueError(f"Unsupported: {file_type}")


@router.post("/execute")
async def execute_code(
    file: UploadFile = File(...),
    code: str = Form(...),
    file_type: str = Form("csv"),
    cell_id: Optional[str] = Form(None),
):
    try:
        df = load_df(await file.read(), file_type)
        result = executor.execute(code, df)
        return JSONResponse(content=sanitize({"cell_id": cell_id or str(uuid.uuid4()), **result}))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/descriptive")
async def descriptive_stats(file: UploadFile = File(...), file_type: str = Form("csv")):
    try:
        df = load_df(await file.read(), file_type)
        return JSONResponse(content=sanitize(analyst.descriptive_stats(df)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correlation")
async def correlation(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    columns: Optional[str] = Form(None),
):
    try:
        df = load_df(await file.read(), file_type)
        cols = json.loads(columns) if columns else None
        return JSONResponse(content=sanitize(analyst.correlation_matrix(df, cols)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regression")
async def regression(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    target: str = Form(...),
    features: str = Form(...),
):
    try:
        df = load_df(await file.read(), file_type)
        return JSONResponse(content=sanitize(analyst.linear_regression(df, target, json.loads(features))))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anova")
async def anova(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    value_col: str = Form(...),
    group_col: str = Form(...),
):
    try:
        df = load_df(await file.read(), file_type)
        return JSONResponse(content=sanitize(analyst.anova(df, value_col, group_col)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ttest")
async def ttest(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    col1: str = Form(...),
    col2: Optional[str] = Form(None),
    group_col: Optional[str] = Form(None),
    mu: float = Form(0),
):
    try:
        df = load_df(await file.read(), file_type)
        return JSONResponse(content=sanitize(analyst.t_test(df, col1, col2, group_col, mu)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chisquare")
async def chisquare(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    col1: str = Form(...),
    col2: str = Form(...),
):
    try:
        df = load_df(await file.read(), file_type)
        return JSONResponse(content=sanitize(analyst.chi_square(df, col1, col2)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-analysis")
async def suggest_analysis(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    question: str = Form(...),
):
    file_bytes = await file.read()
    df = load_df(file_bytes, file_type)

    col_info = []
    for col in df.columns:
        dtype = "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "categorical"
        col_info.append({"name": col, "dtype": dtype,
                         "sample": df[col].dropna().head(3).astype(str).tolist()})

    system_prompt = """You are an elite senior data analyst at a top-tier consulting firm. Given a user question and dataset columns, you produce insightful, publication-quality analysis — never generic summaries.

Return ONLY valid JSON (no markdown fences, no explanation outside JSON):
{"title":"Concise analytical title (3-8 words, e.g. 'Survival Disparity by Passenger Class')",
"operation":"regression|anova|correlation|ttest|chisquare|descriptive|custom",
"code":"python code (see STRICT rules below)",
"columns_used":["col1","col2"],
"explanation":"2-3 sentences: what methodology you used, what the data reveals, and WHY it matters. Be specific with numbers."}

ANALYSIS PHILOSOPHY:
- DIRECTLY answer the user's question. Do not dodge or give generic describe() output.
- Go deeper than surface-level: cross-tabulations, group comparisons, rates, proportions, statistical significance.
- If the question is about relationships, quantify the relationship (effect size, odds ratio, correlation coefficient).
- If the question is about differences, test significance (chi-square, t-test, ANOVA) and report p-values.
- Never just compute mean/median unless the question specifically asks for it.

CHART CODE RULES:
1. df is pre-loaded. Always start with: import pandas as pd, import numpy as np
2. Store final result in variable called 'result'.
3. result MUST be a dict with keys: 'chart_type', 'data', 'x_key', 'y_keys', 'title'
4. 'data' must be a list of dicts (use df.to_dict(orient='records'))
5. Use .dropna() before any statistical operations.
6. NEVER use plt.show(), display(), print(), or matplotlib for charts.

CHART TYPE SELECTION (choose the BEST fit, not always bar):
- 'bar': comparisons across categories (use GROUPED bars with multiple y_keys when comparing 2-3 metrics)
- 'stacked_bar': part-to-whole within categories (e.g. survived vs died per class)
- 'line': trends over time or ordered sequences
- 'scatter': relationships between two numeric variables
- 'pie': proportions of a whole (max 6 slices)
- 'area': cumulative or volume trends

MULTI-SERIES CHARTS (prefer these when possible):
For grouped/stacked bars, include multiple y_keys. Example:
  grouped = df.groupby('Category').agg(Survived=('Survived','sum'), Died=('Survived', lambda x: len(x)-sum(x))).reset_index()
  result = {'chart_type':'bar', 'data': grouped.to_dict(orient='records'),
            'x_key':'Category', 'y_keys':['Survived','Died'], 'title':'Survival by Category'}

DATA QUALITY:
- Always handle NaN with .dropna() or .fillna(0) as appropriate
- Round percentages to 1 decimal, p-values to 4 decimals
- Limit to top 15 categories max for readability
- NEVER fabricate data. Every number must come from the actual dataframe."""

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 1000,
                  "system": system_prompt,
                  "messages": [{"role": "user",
                                "content": f"Question: {question}\n\nColumns:\n{json.dumps(col_info, indent=2)}"}]},
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"].strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        suggestion = json.loads(text.strip())

    execution = executor.execute(suggestion["code"], df)
    return JSONResponse(content=sanitize({"suggestion": suggestion, "execution": execution}))


@router.post("/execute-db")
async def execute_code_db(
    source_type: str = Form(...),
    connection_string: str = Form(...),
    table_name: str = Form(...),
    code: str = Form(...),
    cell_id: Optional[str] = Form(None),
    row_limit: int = Form(100000),
):
    """Execute Python code against a live database connection."""
    try:
        import sqlalchemy
        engine = sqlalchemy.create_engine(
            connection_string, connect_args={"connect_timeout": 10}
        )
        df = pd.read_sql(f"SELECT * FROM {table_name} LIMIT {row_limit}", engine)
        result = executor.execute(code, df)
        return JSONResponse(content=sanitize({
            "cell_id": cell_id or str(uuid.uuid4()),
            "row_count": len(df),
            "source_type": source_type,
            **result,
        }))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database execution failed: {str(e)}")
