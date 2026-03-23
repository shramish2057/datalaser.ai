from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from enum import Enum


class FileType(str, Enum):
    csv = "csv"
    xlsx = "xlsx"
    json = "json"
    parquet = "parquet"


class JoinType(str, Enum):
    inner = "inner"
    left = "left"
    right = "right"
    outer = "outer"


class TransformOperation(str, Enum):
    fill_null = "fill_null"
    drop_null_rows = "drop_null_rows"
    cast_type = "cast_type"
    rename_column = "rename_column"
    drop_column = "drop_column"
    trim_whitespace = "trim_whitespace"
    standardise_case = "standardise_case"
    normalise_dates = "normalise_dates"
    deduplicate = "deduplicate"
    filter_rows = "filter_rows"
    normalise_numeric = "normalise_numeric"
    clip_outliers = "clip_outliers"
    split_column = "split_column"
    merge_columns = "merge_columns"
    regex_replace = "regex_replace"
    one_hot_encode = "one_hot_encode"


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    semantic_role: str = 'unknown'  # measure | dimension | binary | date | id | text
    null_rate: float
    unique_rate: float
    total_values: int
    null_count: int
    unique_count: int
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    mean_value: Optional[float] = None
    median_value: Optional[float] = None
    std_dev: Optional[float] = None
    top_values: List[Dict[str, Any]] = []
    sample_values: List[Any] = []
    format_issues: bool = False
    mixed_types: bool = False
    outlier_count: int = 0
    detected_encoding: Optional[str] = None


class QualityWarning(BaseModel):
    column: str
    issue: str
    severity: str  # yellow | amber | red
    detail: str
    affected_rows: Optional[int] = None


class DataProfile(BaseModel):
    run_id: str
    source_id: str
    file_name: str
    file_type: str
    total_rows: int
    total_columns: int
    file_size_bytes: int
    columns: List[ColumnProfile]
    quality_score: int
    quality_level: str  # good | yellow | amber | red
    warnings: List[QualityWarning]
    detected_encoding: str
    has_header: bool


class TransformStep(BaseModel):
    id: str
    operation: TransformOperation
    column: Optional[str] = None
    params: Dict[str, Any] = {}


class TransformRequest(BaseModel):
    run_id: str
    source_id: str
    file_path: str  # Supabase Storage path
    steps: List[TransformStep]


class TransformResult(BaseModel):
    run_id: str
    success: bool
    rows_before: int
    rows_after: int
    preview: List[Dict[str, Any]]
    columns: List[str]
    staged_path: Optional[str] = None
    errors: List[Dict[str, str]] = []
    lineage: List[Dict[str, Any]] = []


class JoinSource(BaseModel):
    source_id: str
    alias: str
    file_path: str


class JoinDefinition(BaseModel):
    left_source: str
    left_column: str
    right_source: str
    right_column: str
    join_type: JoinType


class JoinRequest(BaseModel):
    project_id: str
    sources: List[JoinSource]
    joins: List[JoinDefinition]


class JoinCandidate(BaseModel):
    left_column: str
    right_column: str
    confidence: float
    overlap_pct: float
    name_similarity: float


class DetectJoinsRequest(BaseModel):
    sources: List[JoinSource]


class ValidationResult(BaseModel):
    test_name: str
    column: Optional[str]
    status: str  # passed | failed | warning
    message: str
    failing_rows: int
    examples: List[Any] = []
    category: str = "issue"  # issue | characteristic | info


class ValidationReport(BaseModel):
    run_id: str
    overall_status: str  # passed | warning | failed
    score: int
    tests: List[ValidationResult]
    summary: str
    issues_count: int = 0
    characteristics_count: int = 0
    fixable_resolved: bool = False


# -- Analysis Templates -------------------------------------------------------

class TemplateMatch(BaseModel):
    template_id: str
    name: str
    category: str
    description: str
    confidence: float
    matched_columns: Dict[str, str]


class TemplateResult(BaseModel):
    template_id: str
    name: str
    category: str
    success: bool
    metrics: Dict[str, Any] = {}
    charts: List[Dict[str, Any]] = []
    findings: List[str] = []
    warnings: List[str] = []
