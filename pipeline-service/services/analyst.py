import pandas as pd
import numpy as np
import scipy.stats as stats
import statsmodels.api as sm
import warnings
import io
import json
from typing import Any

warnings.filterwarnings('ignore')

# ── SAFE EXECUTION SANDBOX ─────────────────────────────────────────────────

BLOCKED_BUILTINS = {
    '__import__', 'open', 'exec', 'eval', 'compile',
    'globals', 'locals', '__builtins__', 'breakpoint', 'input',
}


class SafeExecutor:

    def execute(self, code: str, df: pd.DataFrame, context: dict = None) -> dict:
        safety_check = self._check_safety(code)
        if not safety_check['safe']:
            return {
                'success': False, 'output': None, 'stdout': '',
                'error': f"Blocked: {safety_check['reason']}", 'chart_data': None,
            }

        output_lines: list[str] = []

        def safe_print(*args, **kwargs):
            output_lines.append(' '.join(str(a) for a in args))

        builtins_dict = {}
        if isinstance(__builtins__, dict):
            builtins_dict = {k: v for k, v in __builtins__.items() if k not in BLOCKED_BUILTINS}
        else:
            builtins_dict = {
                k: getattr(__builtins__, k) for k in dir(__builtins__)
                if k not in BLOCKED_BUILTINS and not k.startswith('__')
            }

        namespace: dict[str, Any] = {
            'df': df.copy(), 'pd': pd, 'np': np, 'stats': stats, 'sm': sm,
            'print': safe_print, 'json': json, '__builtins__': builtins_dict,
        }
        if context:
            namespace.update(context)

        try:
            exec(compile(code, '<analyst>', 'exec'), namespace)
            result = namespace.get('result', namespace.get('output', None))
            serialised = self._serialise(result)
            chart_data = self._extract_chart_data(result)
            return {
                'success': True, 'output': serialised,
                'stdout': '\n'.join(output_lines), 'error': None,
                'chart_data': chart_data,
            }
        except Exception as e:
            return {
                'success': False, 'output': None,
                'stdout': '\n'.join(output_lines),
                'error': f"{type(e).__name__}: {str(e)}", 'chart_data': None,
            }

    def _check_safety(self, code: str) -> dict:
        dangerous = [
            ('import os', 'os module not allowed'),
            ('import sys', 'sys module not allowed'),
            ('import subprocess', 'subprocess not allowed'),
            ('import socket', 'socket not allowed'),
            ('import requests', 'requests not allowed'),
            ('import httpx', 'httpx not allowed'),
            ('import urllib', 'urllib not allowed'),
            ('__import__', 'dynamic imports not allowed'),
            ('open(', 'file operations not allowed'),
            ('exec(', 'exec not allowed'),
            ('eval(', 'eval not allowed'),
            ('compile(', 'compile not allowed'),
            ('globals()', 'globals() not allowed'),
            ('locals()', 'locals() not allowed'),
            ('getattr(', 'getattr not allowed for security'),
            ('setattr(', 'setattr not allowed'),
            ('delattr(', 'delattr not allowed'),
            ('__class__', 'class manipulation not allowed'),
            ('__bases__', 'class manipulation not allowed'),
            ('__subclasses__', 'class manipulation not allowed'),
        ]
        code_lower = code.lower()
        for pattern, reason in dangerous:
            if pattern.lower() in code_lower:
                return {'safe': False, 'reason': reason}
        return {'safe': True, 'reason': None}

    def _serialise(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, pd.DataFrame):
            return {'type': 'dataframe', 'columns': list(value.columns),
                    'data': value.head(50).fillna('').to_dict(orient='records'),
                    'shape': list(value.shape)}
        if isinstance(value, pd.Series):
            return {'type': 'series', 'name': value.name,
                    'data': value.head(50).fillna('').to_dict()}
        if isinstance(value, np.ndarray):
            return value.tolist()
        if isinstance(value, (np.integer, np.floating)):
            return float(value)
        if isinstance(value, dict):
            return {str(k): self._serialise(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._serialise(v) for v in value]
        try:
            json.dumps(value)
            return value
        except (TypeError, ValueError):
            return str(value)

    def _extract_chart_data(self, result: Any) -> dict | None:
        if isinstance(result, dict) and 'chart_type' in result and 'data' in result:
            return result
        if isinstance(result, pd.DataFrame) and len(result) > 0:
            cols = list(result.columns)
            numeric_cols = result.select_dtypes(include=[np.number]).columns.tolist()
            if numeric_cols:
                return {'chart_type': 'bar',
                        'data': result.head(20).fillna(0).to_dict(orient='records'),
                        'x_key': cols[0], 'y_keys': numeric_cols[:3],
                        'auto_generated': True}
        return None


# ── PRE-BUILT STATISTICAL OPERATIONS ──────────────────────────────────────

class StatisticalAnalyst:

    def descriptive_stats(self, df: pd.DataFrame) -> dict:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object']).columns.tolist()

        numeric_stats = {}
        for col in numeric_cols:
            s = df[col].dropna()
            if len(s) == 0:
                continue
            numeric_stats[col] = {
                'count': int(len(s)), 'mean': round(float(s.mean()), 4),
                'median': round(float(s.median()), 4), 'std': round(float(s.std()), 4),
                'min': round(float(s.min()), 4), 'max': round(float(s.max()), 4),
                'p25': round(float(s.quantile(0.25)), 4),
                'p75': round(float(s.quantile(0.75)), 4),
                'skewness': round(float(s.skew()), 4),
                'kurtosis': round(float(s.kurtosis()), 4),
                'null_count': int(df[col].isna().sum()),
                'null_rate': round(df[col].isna().mean(), 4),
            }

        categorical_stats = {}
        for col in categorical_cols:
            s = df[col].dropna()
            vc = s.value_counts()
            categorical_stats[col] = {
                'count': int(len(s)), 'unique': int(s.nunique()),
                'top_value': str(vc.index[0]) if len(vc) > 0 else None,
                'top_freq': int(vc.iloc[0]) if len(vc) > 0 else 0,
                'null_count': int(df[col].isna().sum()),
                'distribution': [{'value': str(k), 'count': int(v)} for k, v in vc.head(10).items()],
            }

        return {'total_rows': len(df), 'total_columns': len(df.columns),
                'numeric': numeric_stats, 'categorical': categorical_stats}

    def correlation_matrix(self, df: pd.DataFrame, columns: list = None) -> dict:
        ndf = df.select_dtypes(include=[np.number])
        if columns:
            ndf = ndf[[c for c in columns if c in ndf.columns]]
        if len(ndf.columns) < 2:
            return {'error': 'Need at least 2 numeric columns'}

        corr = ndf.corr(method='pearson')
        cols = list(corr.columns)
        pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                r = corr.iloc[i, j]
                if np.isnan(r):
                    continue
                x = ndf[cols[i]].dropna()
                y = ndf[cols[j]].dropna()
                common = x.index.intersection(y.index)
                if len(common) < 3:
                    continue
                _, pval = stats.pearsonr(x[common], y[common])
                pairs.append({
                    'col1': cols[i], 'col2': cols[j],
                    'r': round(float(r), 4), 'r_squared': round(float(r ** 2), 4),
                    'p_value': round(float(pval), 6), 'significant': pval < 0.05,
                    'strength': self._correlation_strength(abs(r)),
                })
        pairs.sort(key=lambda x: -abs(x['r']))

        # Replace NaN with None for JSON
        matrix_clean = {}
        for c1 in cols:
            matrix_clean[c1] = {}
            for c2 in cols:
                v = corr.loc[c1, c2]
                matrix_clean[c1][c2] = round(float(v), 4) if not np.isnan(v) else None

        return {'matrix': matrix_clean, 'columns': cols,
                'top_correlations': pairs[:10]}

    def linear_regression(self, df: pd.DataFrame, target: str, features: list) -> dict:
        available = [f for f in features if f in df.columns]
        if not available or target not in df.columns:
            return {'error': 'Target or feature columns not found'}
        clean = df[[target] + available].dropna()
        if len(clean) < 10:
            return {'error': 'Need at least 10 rows'}

        X = sm.add_constant(clean[available])
        y = clean[target]
        model = sm.OLS(y, X).fit()

        coefficients = []
        for col in ['const'] + available:
            coefficients.append({
                'variable': col,
                'coefficient': round(float(model.params[col]), 6),
                'std_error': round(float(model.bse[col]), 6),
                't_stat': round(float(model.tvalues[col]), 4),
                'p_value': round(float(model.pvalues[col]), 6),
                'significant': model.pvalues[col] < 0.05,
            })

        return {
            'r_squared': round(float(model.rsquared), 4),
            'adj_r_squared': round(float(model.rsquared_adj), 4),
            'f_statistic': round(float(model.fvalue), 4),
            'f_p_value': round(float(model.f_pvalue), 6),
            'observations': int(model.nobs),
            'coefficients': coefficients,
            'interpretation': self._interpret_regression(model, target, available),
        }

    def anova(self, df: pd.DataFrame, value_col: str, group_col: str) -> dict:
        if value_col not in df.columns or group_col not in df.columns:
            return {'error': 'Columns not found'}
        groups = df.groupby(group_col)[value_col].apply(lambda x: x.dropna().tolist()).to_dict()
        if len(groups) < 2:
            return {'error': 'Need at least 2 groups'}
        group_arrays = [np.array(v) for v in groups.values() if len(v) >= 2]
        f_stat, p_value = stats.f_oneway(*group_arrays)

        group_stats = []
        for name, vals in groups.items():
            arr = np.array(vals)
            group_stats.append({'group': str(name), 'n': len(arr),
                                'mean': round(float(np.mean(arr)), 4),
                                'std': round(float(np.std(arr)), 4)})

        all_vals = np.concatenate(list(groups.values()))
        grand_mean = np.mean(all_vals)
        ss_between = sum(len(v) * (np.mean(v) - grand_mean) ** 2 for v in groups.values())
        ss_total = np.sum((all_vals - grand_mean) ** 2)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0

        return {
            'f_statistic': round(float(f_stat), 4),
            'p_value': round(float(p_value), 6),
            'significant': p_value < 0.05,
            'eta_squared': round(float(eta_sq), 4),
            'effect_size': self._effect_size_label(eta_sq),
            'groups': group_stats,
            'interpretation': (
                f"The difference in {value_col} across {group_col} groups is "
                f"{'significant' if p_value < 0.05 else 'not significant'} "
                f"(F={round(f_stat, 3)}, p={round(p_value, 4)}). "
                f"Effect size: {self._effect_size_label(eta_sq)} (η²={round(eta_sq, 3)})."
            ),
        }

    def t_test(self, df: pd.DataFrame, col1: str, col2: str = None,
               group_col: str = None, mu: float = 0) -> dict:
        if col2 and col2 in df.columns:
            a, b = df[col1].dropna().values, df[col2].dropna().values
            t_stat, p_value = stats.ttest_ind(a, b)
            test_type = 'two-sample independent'
        elif group_col and group_col in df.columns:
            groups = df.groupby(group_col)[col1].apply(lambda x: x.dropna().values).to_dict()
            if len(groups) != 2:
                return {'error': 'group_col must have exactly 2 groups'}
            vals = list(groups.values())
            a, b = vals[0], vals[1]
            t_stat, p_value = stats.ttest_ind(a, b)
            test_type = 'two-sample by group'
        else:
            a = df[col1].dropna().values
            b = None
            t_stat, p_value = stats.ttest_1samp(a, mu)
            test_type = f'one-sample against μ={mu}'

        return {
            'test_type': test_type,
            't_statistic': round(float(t_stat), 4),
            'p_value': round(float(p_value), 6),
            'significant': p_value < 0.05,
            'mean_a': round(float(np.mean(a)), 4),
            'mean_b': round(float(np.mean(b)), 4) if b is not None else None,
        }

    def chi_square(self, df: pd.DataFrame, col1: str, col2: str) -> dict:
        if col1 not in df.columns or col2 not in df.columns:
            return {'error': 'Columns not found'}
        contingency = pd.crosstab(df[col1], df[col2])
        chi2, p_value, dof, _ = stats.chi2_contingency(contingency)
        n = contingency.sum().sum()
        cramers_v = np.sqrt(chi2 / (n * (min(contingency.shape) - 1)))
        return {
            'chi2_statistic': round(float(chi2), 4),
            'p_value': round(float(p_value), 6),
            'degrees_of_freedom': int(dof),
            'significant': p_value < 0.05,
            'cramers_v': round(float(cramers_v), 4),
            'interpretation': (
                f"The relationship between {col1} and {col2} is "
                f"{'statistically significant' if p_value < 0.05 else 'not significant'} "
                f"(χ²={round(chi2, 3)}, p={round(p_value, 4)}, Cramér's V={round(cramers_v, 3)})."
            ),
        }

    def _correlation_strength(self, r: float) -> str:
        if r >= 0.8: return 'very strong'
        if r >= 0.6: return 'strong'
        if r >= 0.4: return 'moderate'
        if r >= 0.2: return 'weak'
        return 'negligible'

    def _effect_size_label(self, v: float) -> str:
        if v >= 0.5: return 'large'
        if v >= 0.3: return 'medium'
        if v >= 0.1: return 'small'
        return 'negligible'

    def _interpret_regression(self, model, target, features) -> str:
        r2 = model.rsquared
        p = model.f_pvalue
        sig_features = [f for f in features if model.pvalues.get(f, 1) < 0.05]
        quality = 'strong' if r2 > 0.7 else 'moderate' if r2 > 0.4 else 'weak'
        text = (f"The model explains {round(r2 * 100, 1)}% of variance in {target} "
                f"(R²={round(r2, 3)}, {quality} fit). "
                f"Overall {'significant' if p < 0.05 else 'not significant'} "
                f"(p={round(float(p), 4)}). ")
        if sig_features:
            text += f"Significant predictors: {', '.join(sig_features)}."
        return text


executor = SafeExecutor()
analyst = StatisticalAnalyst()
