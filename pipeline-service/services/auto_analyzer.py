"""
DataLaser AutoAnalyzer -- Proprietary computation engine.
Runs on data upload, computes correlations, distributions, anomalies,
segments, relationships, and ranks top insights. NO AI/LLM calls.
"""
import pandas as pd
import numpy as np
import scipy.stats as stats
import warnings
from typing import Any

from services.analyst import analyst as stat_analyst

warnings.filterwarnings('ignore')


class AutoAnalyzer:

    def analyze(self, df: pd.DataFrame, column_profiles: list[dict]) -> dict:
        """Run full auto-analysis on a DataFrame. Returns structured results."""
        measures = [c['name'] for c in column_profiles if c.get('semantic_role') == 'measure']
        dimensions = [c['name'] for c in column_profiles if c.get('semantic_role') == 'dimension']
        binaries = [c['name'] for c in column_profiles if c.get('semantic_role') == 'binary']
        dates = [c['name'] for c in column_profiles if c.get('semantic_role') == 'date']

        results = {
            'row_count': len(df),
            'column_count': len(df.columns),
            'measures': measures,
            'dimensions': dimensions,
            'binaries': binaries,
            'dates': dates,
            'correlations': self._compute_correlations(df, measures),
            'distributions': self._compute_distributions(df, measures),
            'anomalies': self._compute_anomalies(df, measures),
            'segments': self._compute_segments(df, dimensions, measures),
            'relationships': self._compute_relationships(df, dimensions, binaries, measures),
            'trends': self._compute_trends(df, dates, measures),
            'majority': self._compute_majority(df, dimensions, measures),
            'low_variance': self._compute_low_variance(df, dimensions, measures),
            'key_influencers': self._compute_key_influencers(df, binaries, measures, dimensions),
            'temporal_patterns': self._compute_temporal_patterns(df, dates, measures),
            'clusters': self._compute_clusters(df, measures),
            'outlier_explanations': self._compute_outlier_explanations(df, measures, dimensions),
            'contribution_analysis': self._compute_contribution_analysis(df, dimensions, measures),
            'forecasts': self._compute_forecasts(df, dates, measures),
            'cross_correlations': self._compute_cross_correlations(df, measures),
            'top_insights': [],
        }

        # Rank and generate top insights from all findings
        results['top_insights'] = self._rank_insights(results, df)
        return results

    # -- Correlations ----------------------------------------------------------

    def _compute_correlations(self, df: pd.DataFrame, measures: list[str]) -> dict:
        if len(measures) < 2:
            return {'pairs': [], 'matrix': {}}

        valid = [m for m in measures if m in df.columns]
        if len(valid) < 2:
            return {'pairs': [], 'matrix': {}}

        result = stat_analyst.correlation_matrix(df, valid)
        if 'error' in result:
            return {'pairs': [], 'matrix': {}}
        return {
            'pairs': result.get('top_correlations', [])[:10],
            'matrix': result.get('matrix', {}),
            'columns': result.get('columns', []),
        }

    # -- Distributions ---------------------------------------------------------

    def _compute_distributions(self, df: pd.DataFrame, measures: list[str]) -> list[dict]:
        distributions = []
        for col in measures:
            if col not in df.columns:
                continue
            series = df[col].dropna()
            if len(series) < 5:
                continue
            arr = series.values.astype(float)

            # Histogram bins (Sturges' rule)
            n_bins = min(int(np.ceil(np.log2(len(arr)) + 1)), 30)
            counts, bin_edges = np.histogram(arr, bins=n_bins)

            # Shape stats
            skewness = float(stats.skew(arr))
            kurtosis_val = float(stats.kurtosis(arr))

            # Normality test (D'Agostino-Pearson)
            normality_p = None
            if len(arr) >= 20:
                try:
                    _, normality_p = stats.normaltest(arr)
                    normality_p = float(normality_p)
                except Exception:
                    pass

            # Shape classification
            if normality_p is not None and normality_p > 0.05:
                shape = 'normal'
            elif abs(skewness) < 0.5:
                shape = 'symmetric'
            elif skewness > 1:
                shape = 'right-skewed'
            elif skewness < -1:
                shape = 'left-skewed'
            elif skewness > 0:
                shape = 'slightly-right-skewed'
            else:
                shape = 'slightly-left-skewed'

            distributions.append({
                'column': col,
                'bins': [round(float(e), 4) for e in bin_edges],
                'counts': [int(c) for c in counts],
                'mean': round(float(np.mean(arr)), 4),
                'median': round(float(np.median(arr)), 4),
                'std': round(float(np.std(arr)), 4),
                'skewness': round(skewness, 4),
                'kurtosis': round(kurtosis_val, 4),
                'normality_p': round(normality_p, 6) if normality_p is not None else None,
                'shape': shape,
                'min': round(float(np.min(arr)), 4),
                'max': round(float(np.max(arr)), 4),
            })
        return distributions

    # -- Anomalies -------------------------------------------------------------

    def _compute_anomalies(self, df: pd.DataFrame, measures: list[str]) -> list[dict]:
        anomalies = []
        for col in measures:
            if col not in df.columns:
                continue
            series = df[col].dropna()
            if len(series) < 10:
                continue
            arr = series.values.astype(float)

            # IQR method
            q1, q3 = np.percentile(arr, [25, 75])
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_mask = (arr < lower) | (arr > upper)
            outlier_count = int(np.sum(outlier_mask))

            if outlier_count == 0:
                continue

            outlier_pct = round(outlier_count / len(arr) * 100, 1)
            # Get a few example outlier values
            outlier_vals = arr[outlier_mask][:5].tolist()

            # Z-score method (complementary)
            z_scores = np.abs((arr - np.mean(arr)) / (np.std(arr) + 1e-10))
            z_outlier_count = int(np.sum(z_scores > 3))

            severity = 'high' if outlier_pct > 5 else 'medium' if outlier_pct > 2 else 'low'

            anomalies.append({
                'column': col,
                'outlier_count': outlier_count,
                'outlier_pct': outlier_pct,
                'severity': severity,
                'method': 'IQR_1.5x',
                'lower_bound': round(float(lower), 4),
                'upper_bound': round(float(upper), 4),
                'example_values': [round(float(v), 4) for v in outlier_vals],
                'z_score_outliers': z_outlier_count,
                'z_score_pct': round(z_outlier_count / len(arr) * 100, 1),
            })

        anomalies.sort(key=lambda x: -x['outlier_pct'])
        return anomalies

    # -- Segment Analysis ------------------------------------------------------

    def _compute_segments(self, df: pd.DataFrame, dimensions: list[str],
                          measures: list[str]) -> list[dict]:
        segments = []
        for dim in dimensions[:5]:  # Limit to avoid combinatorial explosion
            if dim not in df.columns:
                continue
            groups = df[dim].dropna().nunique()
            if groups < 2 or groups > 20:
                continue

            for measure in measures[:5]:
                if measure not in df.columns:
                    continue
                try:
                    result = stat_analyst.anova(df, measure, dim)
                    if 'error' in result:
                        continue
                    if result.get('p_value', 1) > 0.1:
                        continue  # Skip non-significant

                    # Build chart data
                    group_data = result.get('groups', [])
                    chart_data = {
                        'chart_type': 'bar',
                        'data': group_data,
                        'x_key': 'group',
                        'y_keys': ['mean'],
                        'title': f'{measure} by {dim}',
                    }

                    segments.append({
                        'dimension': dim,
                        'measure': measure,
                        'f_statistic': result.get('f_statistic'),
                        'p_value': result.get('p_value'),
                        'eta_squared': result.get('eta_squared'),
                        'effect_size': result.get('effect_size'),
                        'groups': group_data,
                        'chart_data': chart_data,
                    })
                except Exception:
                    continue

        segments.sort(key=lambda x: x.get('p_value', 1))
        return segments[:10]

    # -- Relationship Discovery ------------------------------------------------

    def _compute_relationships(self, df: pd.DataFrame, dimensions: list[str],
                               binaries: list[str], measures: list[str]) -> list[dict]:
        relationships = []

        # Dimension x Binary (chi-square)
        cat_cols = dimensions + binaries
        for i, col1 in enumerate(cat_cols[:6]):
            for col2 in cat_cols[i + 1:6]:
                if col1 not in df.columns or col2 not in df.columns:
                    continue
                try:
                    result = stat_analyst.chi_square(df, col1, col2)
                    if 'error' in result or result.get('p_value', 1) > 0.05:
                        continue
                    relationships.append({
                        'col1': col1, 'col2': col2,
                        'test': 'chi_square',
                        'statistic': result.get('chi2_statistic'),
                        'p_value': result.get('p_value'),
                        'effect_size': result.get('cramers_v'),
                        'effect_label': self._cramers_v_label(result.get('cramers_v', 0)),
                    })
                except Exception:
                    continue

        relationships.sort(key=lambda x: -(x.get('effect_size') or 0))
        return relationships[:10]

    # -- Trend Detection (change points, direction, seasonality) ----------------

    def _compute_trends(self, df: pd.DataFrame, dates: list[str],
                        measures: list[str]) -> list[dict]:
        """Detect significant trends, change points, and seasonality in time-indexed data."""
        trends = []
        if not dates or not measures:
            return trends

        for date_col in dates[:2]:
            if date_col not in df.columns:
                continue
            tdf = df.copy()
            tdf[date_col] = pd.to_datetime(tdf[date_col], errors='coerce')
            tdf = tdf.dropna(subset=[date_col]).sort_values(date_col)
            if len(tdf) < 10:
                continue

            for measure_col in measures[:3]:
                if measure_col not in tdf.columns:
                    continue
                series = tdf[measure_col].dropna()
                if len(series) < 10:
                    continue
                arr = series.values.astype(float)

                # Trend direction via linear regression
                x = np.arange(len(arr)).astype(float)
                slope, intercept = np.polyfit(x, arr, 1)
                # Significance of trend
                r_val = np.corrcoef(x, arr)[0, 1]
                t_stat = r_val * np.sqrt((len(arr) - 2) / (1 - r_val ** 2 + 1e-10))
                p_val = 2 * (1 - stats.t.cdf(abs(t_stat), len(arr) - 2))

                direction = 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'flat'
                total_change_pct = round((arr[-1] - arr[0]) / (abs(arr[0]) + 1e-10) * 100, 1)

                trend_entry = {
                    'date_column': date_col,
                    'measure_column': measure_col,
                    'direction': direction,
                    'slope': round(float(slope), 6),
                    'r_squared': round(float(r_val ** 2), 4),
                    'p_value': round(float(p_val), 6),
                    'significant': p_val < 0.05,
                    'total_change_pct': total_change_pct,
                    'data_points': len(arr),
                }

                # Change point detection (simple: sliding window mean shift)
                change_points = self._detect_change_points(arr)
                trend_entry['change_points'] = change_points

                # Seasonality detection (autocorrelation peaks)
                seasonality = self._detect_seasonality(arr)
                trend_entry['seasonality'] = seasonality

                trends.append(trend_entry)

        trends.sort(key=lambda t: abs(t.get('total_change_pct', 0)), reverse=True)
        return trends

    def _detect_change_points(self, arr: np.ndarray, min_segment: int = 5) -> list[dict]:
        """Simple change point detection using mean shift with significance test."""
        n = len(arr)
        if n < min_segment * 2:
            return []

        best_score = 0
        best_idx = -1

        for i in range(min_segment, n - min_segment):
            left = arr[:i]
            right = arr[i:]
            # T-test between segments
            t_stat, p_val = stats.ttest_ind(left, right)
            score = abs(t_stat)
            if score > best_score and p_val < 0.05:
                best_score = score
                best_idx = i

        if best_idx < 0:
            return []

        left_mean = float(np.mean(arr[:best_idx]))
        right_mean = float(np.mean(arr[best_idx:]))
        shift_pct = round((right_mean - left_mean) / (abs(left_mean) + 1e-10) * 100, 1)

        return [{
            'index': best_idx,
            'left_mean': round(left_mean, 4),
            'right_mean': round(right_mean, 4),
            'shift_pct': shift_pct,
            'direction': 'increase' if shift_pct > 0 else 'decrease',
        }]

    def _detect_seasonality(self, arr: np.ndarray) -> dict | None:
        """Detect seasonality via autocorrelation peaks."""
        n = len(arr)
        if n < 14:  # Need enough data for meaningful autocorrelation
            return None

        # Detrend
        detrended = arr - np.polyval(np.polyfit(np.arange(n), arr, 1), np.arange(n))
        # Autocorrelation
        acf = np.correlate(detrended, detrended, mode='full')
        acf = acf[n - 1:] / acf[n - 1]  # Normalize

        # Find peaks in autocorrelation (skip lag 0)
        peaks = []
        for i in range(2, min(n // 2, len(acf))):
            is_peak = acf[i] > acf[i - 1] and (i + 1 >= len(acf) or acf[i] > acf[i + 1])
            if is_peak and acf[i] > 0.3:  # Significant autocorrelation
                peaks.append({'lag': i, 'strength': round(float(acf[i]), 4)})

        if not peaks:
            return None

        best = max(peaks, key=lambda p: p['strength'])
        return {
            'detected': True,
            'period': best['lag'],
            'strength': best['strength'],
            'peaks': peaks[:3],
        }

    # -- Majority Detection ----------------------------------------------------

    def _compute_majority(self, df: pd.DataFrame, dimensions: list[str],
                          measures: list[str]) -> list[dict]:
        """Detect when one category dominates a measure (Power BI 'majority' insight)."""
        majority = []
        for dim in dimensions[:5]:
            if dim not in df.columns:
                continue
            for measure in measures[:3]:
                if measure not in df.columns:
                    continue
                grouped = df.groupby(dim)[measure].sum().sort_values(ascending=False)
                total = grouped.sum()
                if total == 0 or len(grouped) < 3:
                    continue

                top_share = float(grouped.iloc[0] / total)
                top2_share = float(grouped.iloc[:2].sum() / total) if len(grouped) >= 2 else top_share

                # Majority = top category has > 50%, or top 2 have > 75%
                if top_share > 0.5 or top2_share > 0.75:
                    majority.append({
                        'dimension': dim,
                        'measure': measure,
                        'dominant_category': str(grouped.index[0]),
                        'dominant_share': round(top_share * 100, 1),
                        'top2_share': round(top2_share * 100, 1),
                        'total_categories': len(grouped),
                        'total_value': round(float(total), 2),
                    })

        majority.sort(key=lambda m: -m['dominant_share'])
        return majority

    # -- Low Variance Detection ------------------------------------------------

    def _compute_low_variance(self, df: pd.DataFrame, dimensions: list[str],
                              measures: list[str]) -> list[dict]:
        """Detect when a measure is remarkably uniform across a dimension (Power BI 'low variance')."""
        low_var = []
        for dim in dimensions[:5]:
            if dim not in df.columns:
                continue
            for measure in measures[:3]:
                if measure not in df.columns:
                    continue
                grouped = df.groupby(dim)[measure].mean()
                if len(grouped) < 3:
                    continue

                cv = float(grouped.std() / (grouped.mean() + 1e-10))  # Coefficient of variation
                if cv < 0.15:  # Less than 15% variation = remarkably uniform
                    low_var.append({
                        'dimension': dim,
                        'measure': measure,
                        'cv': round(cv, 4),
                        'mean': round(float(grouped.mean()), 4),
                        'std': round(float(grouped.std()), 4),
                        'min_group': str(grouped.idxmin()),
                        'max_group': str(grouped.idxmax()),
                        'min_val': round(float(grouped.min()), 4),
                        'max_val': round(float(grouped.max()), 4),
                    })

        low_var.sort(key=lambda l: l['cv'])
        return low_var

    # -- Key Influencer Detection ----------------------------------------------

    def _compute_key_influencers(self, df: pd.DataFrame, binaries: list[str],
                                  measures: list[str], dimensions: list[str]) -> list[dict]:
        """Rank which dimensions/measures most strongly predict a binary outcome.
        Similar to Power BI Key Influencers visual."""
        influencers = []
        targets = binaries[:2]  # Analyze top 2 binary columns

        for target in targets:
            if target not in df.columns:
                continue
            target_series = df[target].dropna()
            if len(target_series.unique()) != 2:
                continue

            # Test each dimension via chi-square
            for dim in dimensions[:6]:
                if dim not in df.columns or dim == target:
                    continue
                try:
                    result = stat_analyst.chi_square(df, target, dim)
                    if 'error' in result or result.get('p_value', 1) > 0.05:
                        continue

                    # Compute rates per group
                    ct = pd.crosstab(df[dim], df[target], normalize='index')
                    positive_col = ct.columns[-1]  # Assume last column is "positive"
                    rates = ct[positive_col].sort_values(ascending=False)
                    overall_rate = float(df[target].mean())

                    influencers.append({
                        'target': target,
                        'influencer': dim,
                        'type': 'categorical',
                        'cramers_v': result.get('cramers_v', 0),
                        'p_value': result.get('p_value', 1),
                        'overall_rate': round(overall_rate, 4),
                        'best_group': str(rates.index[0]),
                        'best_rate': round(float(rates.iloc[0]), 4),
                        'worst_group': str(rates.index[-1]),
                        'worst_rate': round(float(rates.iloc[-1]), 4),
                        'lift': round(float(rates.iloc[0] / (overall_rate + 1e-10)), 2),
                    })
                except Exception:
                    continue

            # Test each measure via point-biserial correlation
            for measure in measures[:6]:
                if measure not in df.columns or measure == target:
                    continue
                try:
                    clean = df[[target, measure]].dropna()
                    if len(clean) < 10:
                        continue
                    r, p = stats.pointbiserialr(clean[target].astype(float), clean[measure].astype(float))
                    if p > 0.05:
                        continue

                    group_means = clean.groupby(target)[measure].mean()
                    influencers.append({
                        'target': target,
                        'influencer': measure,
                        'type': 'numeric',
                        'correlation': round(float(r), 4),
                        'p_value': round(float(p), 6),
                        'overall_rate': round(float(df[target].mean()), 4),
                        'mean_when_0': round(float(group_means.iloc[0]), 4) if len(group_means) >= 1 else None,
                        'mean_when_1': round(float(group_means.iloc[1]), 4) if len(group_means) >= 2 else None,
                    })
                except Exception:
                    continue

        influencers.sort(key=lambda x: abs(x.get('cramers_v', 0) or x.get('correlation', 0)), reverse=True)
        return influencers[:10]

    # -- Temporal Patterns (day-of-week, monthly) ------------------------------

    def _compute_temporal_patterns(self, df: pd.DataFrame, dates: list[str],
                                    measures: list[str]) -> list[dict]:
        """Detect patterns by day-of-week, month, hour (like Metabase X-ray)."""
        patterns = []
        if not dates or not measures:
            return patterns

        for date_col in dates[:1]:
            if date_col not in df.columns:
                continue
            tdf = df.copy()
            tdf['_dt'] = pd.to_datetime(tdf[date_col], errors='coerce')
            tdf = tdf.dropna(subset=['_dt'])
            if len(tdf) < 7:
                continue

            for measure in measures[:2]:
                if measure not in tdf.columns:
                    continue

                # Day of week
                tdf['_dow'] = tdf['_dt'].dt.day_name()
                dow_stats = tdf.groupby('_dow')[measure].agg(['mean', 'count']).reset_index()
                dow_stats.columns = ['day', 'mean', 'count']
                dow_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                dow_stats['_order'] = dow_stats['day'].map({d: i for i, d in enumerate(dow_order)})
                dow_stats = dow_stats.sort_values('_order').drop(columns=['_order'])
                if len(dow_stats) >= 5:
                    best_day = dow_stats.loc[dow_stats['mean'].idxmax()]
                    worst_day = dow_stats.loc[dow_stats['mean'].idxmin()]
                    # ANOVA to test if day-of-week differences are significant
                    dow_groups = [g[measure].dropna().values for _, g in tdf.groupby('_dow') if len(g) >= 2]
                    dow_p = 1.0
                    if len(dow_groups) >= 2:
                        try:
                            _, dow_p = stats.f_oneway(*dow_groups)
                        except Exception:
                            pass
                    patterns.append({
                        'date_column': date_col,
                        'measure': measure,
                        'pattern_type': 'day_of_week',
                        'significant': dow_p < 0.05,
                        'p_value': round(float(dow_p), 6),
                        'best': {'name': best_day['day'], 'mean': round(float(best_day['mean']), 2)},
                        'worst': {'name': worst_day['day'], 'mean': round(float(worst_day['mean']), 2)},
                        'chart_data': {
                            'chart_type': 'bar',
                            'data': dow_stats[['day', 'mean']].round(2).to_dict(orient='records'),
                            'x_key': 'day', 'y_keys': ['mean'],
                            'title': f'{measure} by Day of Week',
                        },
                    })

                # Month
                tdf['_month'] = tdf['_dt'].dt.month_name()
                month_stats = tdf.groupby('_month')[measure].agg(['mean', 'count']).reset_index()
                month_stats.columns = ['month', 'mean', 'count']
                if len(month_stats) >= 3:
                    best_month = month_stats.loc[month_stats['mean'].idxmax()]
                    worst_month = month_stats.loc[month_stats['mean'].idxmin()]
                    patterns.append({
                        'date_column': date_col,
                        'measure': measure,
                        'pattern_type': 'monthly',
                        'best': {'name': best_month['month'], 'mean': round(float(best_month['mean']), 2)},
                        'worst': {'name': worst_month['month'], 'mean': round(float(worst_month['mean']), 2)},
                        'chart_data': {
                            'chart_type': 'bar',
                            'data': month_stats[['month', 'mean']].round(2).to_dict(orient='records'),
                            'x_key': 'month', 'y_keys': ['mean'],
                            'title': f'{measure} by Month',
                        },
                    })

        return patterns

    # -- K-Means Clustering ----------------------------------------------------

    def _compute_clusters(self, df: pd.DataFrame, measures: list[str]) -> dict:
        """Auto-segment data into clusters using K-means on numeric columns."""
        valid = [m for m in measures if m in df.columns]
        if len(valid) < 2:
            return {'clusters': [], 'n_clusters': 0}

        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler

        clean = df[valid].dropna()
        if len(clean) < 10:
            return {'clusters': [], 'n_clusters': 0}

        # Standardize
        scaler = StandardScaler()
        scaled = scaler.fit_transform(clean)

        # Optimal k via elbow heuristic (2-6 clusters)
        max_k = min(6, len(clean) // 5)
        if max_k < 2:
            return {'clusters': [], 'n_clusters': 0}

        inertias = []
        for k in range(2, max_k + 1):
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            km.fit(scaled)
            inertias.append(km.inertia_)

        # Pick k via second-derivative (acceleration) of inertia curve
        best_k = 2
        if len(inertias) >= 3:
            # Second derivative: where the rate of decrease itself drops most
            diffs = [inertias[i - 1] - inertias[i] for i in range(1, len(inertias))]
            accelerations = [diffs[i - 1] - diffs[i] for i in range(1, len(diffs))]
            if accelerations:
                best_k = accelerations.index(max(accelerations)) + 3  # +3 because offset by 2 diffs
                best_k = min(best_k, max_k)
        elif len(inertias) == 2:
            # With only 2 options, pick based on relative improvement
            improvement = (inertias[0] - inertias[1]) / (inertias[0] + 1e-10)
            best_k = 3 if improvement > 0.3 else 2

        km = KMeans(n_clusters=best_k, n_init=10, random_state=42)
        labels = km.fit_predict(scaled)

        # Cluster profiles
        cluster_profiles = []
        for c in range(best_k):
            mask = labels == c
            profile = {'cluster': c, 'size': int(mask.sum()), 'pct': round(float(mask.mean() * 100), 1)}
            for col in valid:
                profile[f'{col}_mean'] = round(float(clean.loc[mask, col].mean()), 4)
            cluster_profiles.append(profile)

        cluster_profiles.sort(key=lambda x: -x['size'])

        return {
            'n_clusters': best_k,
            'columns_used': valid,
            'clusters': cluster_profiles,
            'total_rows_clustered': len(clean),
        }

    # -- Outlier Explanation ---------------------------------------------------

    def _compute_outlier_explanations(self, df: pd.DataFrame, measures: list[str],
                                       dimensions: list[str]) -> list[dict]:
        """For each outlier column, explain WHICH dimension values contain the outliers."""
        explanations = []
        for col in measures[:4]:
            if col not in df.columns:
                continue
            series = df[col].dropna()
            if len(series) < 10:
                continue
            arr = series.values.astype(float)
            q1, q3 = np.percentile(arr, [25, 75])
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outlier_mask = (df[col] < lower) | (df[col] > upper)
            n_outliers = int(outlier_mask.sum())
            if n_outliers == 0:
                continue

            # Which dimensions explain the outliers?
            dim_explanations = []
            for dim in dimensions[:4]:
                if dim not in df.columns:
                    continue
                # Compare outlier group vs non-outlier group distribution
                outlier_dist = df.loc[outlier_mask, dim].value_counts(normalize=True)
                normal_dist = df.loc[~outlier_mask, dim].value_counts(normalize=True)
                # Find over-represented categories in outliers
                for cat in outlier_dist.index[:5]:
                    outlier_share = float(outlier_dist.get(cat, 0))
                    normal_share = float(normal_dist.get(cat, 0))
                    if outlier_share > normal_share * 1.5 and outlier_share > 0.1:
                        over_rep = round(outlier_share / max(normal_share, 0.01), 1)
                        dim_explanations.append({
                            'dimension': dim,
                            'category': str(cat),
                            'outlier_share': round(outlier_share * 100, 1),
                            'normal_share': round(normal_share * 100, 1),
                            'overrepresentation': min(over_rep, 99.9),  # Cap at 99.9x
                        })

            dim_explanations.sort(key=lambda x: -x['overrepresentation'])
            if dim_explanations:
                explanations.append({
                    'column': col,
                    'n_outliers': n_outliers,
                    'explanations': dim_explanations[:3],
                })

        return explanations

    # -- Contribution / Driver Analysis ----------------------------------------

    def _compute_contribution_analysis(self, df: pd.DataFrame, dimensions: list[str],
                                        measures: list[str]) -> list[dict]:
        """For each measure, decompose total by dimension and compute contribution %."""
        contributions = []
        for measure in measures[:3]:
            if measure not in df.columns:
                continue
            total = df[measure].sum()
            if total == 0:
                continue

            for dim in dimensions[:3]:
                if dim not in df.columns:
                    continue
                grouped = df.groupby(dim)[measure].agg(['sum', 'mean', 'count'])
                grouped['contribution_pct'] = (grouped['sum'] / total * 100).round(1)
                grouped = grouped.sort_values('contribution_pct', ascending=False).head(10)

                top = grouped.iloc[0] if len(grouped) > 0 else None
                if top is None:
                    continue

                contributions.append({
                    'measure': measure,
                    'dimension': dim,
                    'total': round(float(total), 2),
                    'top_contributor': str(grouped.index[0]),
                    'top_contribution_pct': round(float(top['contribution_pct']), 1),
                    'breakdown': [
                        {'category': str(idx), 'value': round(float(row['sum']), 2),
                         'pct': round(float(row['contribution_pct']), 1),
                         'count': int(row['count'])}
                        for idx, row in grouped.iterrows()
                    ],
                    'chart_data': {
                        'chart_type': 'bar',
                        'data': [{'category': str(idx), 'contribution': round(float(row['contribution_pct']), 1)}
                                 for idx, row in grouped.iterrows()],
                        'x_key': 'category', 'y_keys': ['contribution'],
                        'title': f'{measure} Contribution by {dim}',
                    },
                })

        contributions.sort(key=lambda c: -c.get('top_contribution_pct', 0))
        return contributions

    # -- Simple Forecasting ----------------------------------------------------

    def _compute_forecasts(self, df: pd.DataFrame, dates: list[str],
                           measures: list[str]) -> list[dict]:
        """Simple linear extrapolation with confidence interval for time-series data."""
        forecasts = []
        if not dates or not measures:
            return forecasts

        for date_col in dates[:1]:
            if date_col not in df.columns:
                continue
            tdf = df.copy()
            tdf[date_col] = pd.to_datetime(tdf[date_col], errors='coerce')
            tdf = tdf.dropna(subset=[date_col]).sort_values(date_col)
            if len(tdf) < 10:
                continue

            for measure in measures[:2]:
                if measure not in tdf.columns:
                    continue
                series = tdf[measure].dropna()
                if len(series) < 10:
                    continue
                arr = series.values.astype(float)
                x = np.arange(len(arr)).astype(float)

                # Linear regression
                slope, intercept = np.polyfit(x, arr, 1)
                linear_pred = slope * x + intercept
                linear_residuals = arr - linear_pred
                linear_r2 = round(float(1 - np.var(linear_residuals) / (np.var(arr) + 1e-10)), 4)

                # Exponential smoothing (Holt's method — level + trend)
                alpha, beta = 0.3, 0.1
                level = arr[0]
                trend_val = arr[1] - arr[0] if len(arr) > 1 else 0
                es_fitted = []
                for val in arr:
                    prev_level = level
                    level = alpha * val + (1 - alpha) * (level + trend_val)
                    trend_val = beta * (level - prev_level) + (1 - beta) * trend_val
                    es_fitted.append(level)
                es_residuals = arr - np.array(es_fitted)
                es_r2 = round(float(1 - np.var(es_residuals) / (np.var(arr) + 1e-10)), 4)

                # Pick better method
                if es_r2 > linear_r2:
                    method = 'exponential_smoothing'
                    r2 = es_r2
                    residuals = es_residuals
                    std_err = float(np.std(residuals))
                    forecast_vals = []
                    for _ in range(5):
                        level = level + trend_val
                        forecast_vals.append(level)
                else:
                    method = 'linear_extrapolation'
                    r2 = linear_r2
                    residuals = linear_residuals
                    std_err = float(np.std(residuals))
                    forecast_x = np.arange(len(arr), len(arr) + 5)
                    forecast_vals = (slope * forecast_x + intercept).tolist()

                forecasts.append({
                    'date_column': date_col,
                    'measure': measure,
                    'method': method,
                    'slope': round(float(slope), 6),
                    'r_squared': r2,
                    'std_error': round(std_err, 4),
                    'last_actual': round(float(arr[-1]), 4),
                    'forecast_values': [round(float(v), 4) for v in forecast_vals],
                    'confidence_upper': [round(float(v + 1.96 * std_err), 4) for v in forecast_vals],
                    'confidence_lower': [round(float(v - 1.96 * std_err), 4) for v in forecast_vals],
                    'periods_ahead': 5,
                    'linear_r2': linear_r2,
                    'es_r2': es_r2,
                })

        return forecasts

    # -- Cross-Correlation (Lag Analysis) --------------------------------------

    def _compute_cross_correlations(self, df: pd.DataFrame, measures: list[str]) -> list[dict]:
        """Find leading/lagging relationships between measures (ThoughtSpot-style)."""
        cross_corrs = []
        valid = [m for m in measures if m in df.columns]
        if len(valid) < 2:
            return cross_corrs

        max_lag = min(10, len(df) // 4)
        if max_lag < 2:
            return cross_corrs

        for i, col1 in enumerate(valid[:4]):
            for col2 in valid[i + 1:4]:
                clean = df[[col1, col2]].dropna()
                if len(clean) < 20:
                    continue
                a = clean[col1].values.astype(float)
                b = clean[col2].values.astype(float)

                # Standardize
                a = (a - a.mean()) / (a.std() + 1e-10)
                b = (b - b.mean()) / (b.std() + 1e-10)

                best_lag = 0
                best_corr = abs(np.corrcoef(a, b)[0, 1])

                for lag in range(1, max_lag + 1):
                    # col1 leads col2 by 'lag'
                    if lag < len(a):
                        r_forward = abs(np.corrcoef(a[:-lag], b[lag:])[0, 1]) if len(a) > lag else 0
                        if r_forward > best_corr:
                            best_corr = r_forward
                            best_lag = lag  # col1 leads
                        # col2 leads col1
                        r_backward = abs(np.corrcoef(a[lag:], b[:-lag])[0, 1]) if len(a) > lag else 0
                        if r_backward > best_corr:
                            best_corr = r_backward
                            best_lag = -lag  # col2 leads

                if best_lag != 0 and best_corr > 0.3:
                    leader = col1 if best_lag > 0 else col2
                    follower = col2 if best_lag > 0 else col1
                    cross_corrs.append({
                        'leader': leader,
                        'follower': follower,
                        'lag': abs(best_lag),
                        'correlation_at_lag': round(float(best_corr), 4),
                        'correlation_at_zero': round(float(abs(np.corrcoef(a, b)[0, 1])), 4),
                        'improvement': round(float(best_corr - abs(np.corrcoef(a, b)[0, 1])), 4),
                    })

        cross_corrs.sort(key=lambda x: -x['correlation_at_lag'])
        return cross_corrs

    # -- Insight Ranking -------------------------------------------------------

    def _rank_insights(self, results: dict, df: pd.DataFrame) -> list[dict]:
        """Rank all findings by significance x effect size, return top 8."""
        candidates = []

        # From correlations
        for pair in results['correlations'].get('pairs', []):
            r = abs(pair.get('r', 0))
            p = pair.get('p_value', 1)
            if p < 0.05 and r > 0.15:
                candidates.append({
                    'type': 'correlation',
                    'headline': f"{pair['col1']} and {pair['col2']} are {pair.get('strength', 'correlated')}ly correlated (r={pair['r']}, p={'<0.001' if p < 0.001 else round(p, 4)})",
                    'columns': [pair['col1'], pair['col2']],
                    'p_value': p,
                    'effect_size': r,
                    'chart_data': self._scatter_chart(df, pair['col1'], pair['col2']),
                })

        # From segments (group differences)
        for seg in results['segments']:
            p = seg.get('p_value', 1)
            eta = seg.get('eta_squared', 0)
            if p < 0.05:
                groups = seg.get('groups', [])
                if len(groups) >= 2:
                    sorted_g = sorted(groups, key=lambda g: -g.get('mean', 0))
                    high = sorted_g[0]
                    low = sorted_g[-1]
                    ratio = round(high['mean'] / low['mean'], 1) if low['mean'] != 0 else 'inf'
                    candidates.append({
                        'type': 'group_difference',
                        'headline': f"{seg['measure']} differs significantly across {seg['dimension']} — {high['group']} averages {round(high['mean'], 2)} vs {low['group']} at {round(low['mean'], 2)} ({ratio}x)",
                        'columns': [seg['dimension'], seg['measure']],
                        'p_value': p,
                        'effect_size': eta,
                        'chart_data': seg.get('chart_data'),
                    })

        # From anomalies
        for anom in results['anomalies']:
            if anom['severity'] in ('high', 'medium'):
                candidates.append({
                    'type': 'anomaly',
                    'headline': f"{anom['column']} has {anom['outlier_count']} outliers ({anom['outlier_pct']}% of values) outside [{round(anom['lower_bound'], 1)}, {round(anom['upper_bound'], 1)}]",
                    'columns': [anom['column']],
                    'p_value': 0.01,  # Proxy significance
                    'effect_size': anom['outlier_pct'] / 100,
                    'chart_data': None,
                })

        # From distributions (highly skewed)
        for dist in results['distributions']:
            if abs(dist['skewness']) > 1.5:
                candidates.append({
                    'type': 'distribution',
                    'headline': f"{dist['column']} is {dist['shape']} (skewness={dist['skewness']}) — median {dist['median']} vs mean {dist['mean']}",
                    'columns': [dist['column']],
                    'p_value': dist.get('normality_p', 0.01) or 0.01,
                    'effect_size': abs(dist['skewness']) / 3,  # Normalize
                    'chart_data': {
                        'chart_type': 'histogram',
                        'data': [{'bin': round((dist['bins'][i] + dist['bins'][i + 1]) / 2, 2),
                                  'count': dist['counts'][i]}
                                 for i in range(len(dist['counts']))],
                        'x_key': 'bin',
                        'y_keys': ['count'],
                        'title': f'Distribution of {dist["column"]}',
                    },
                })

        # From relationships
        for rel in results['relationships']:
            if rel.get('effect_size', 0) > 0.1:
                candidates.append({
                    'type': 'association',
                    'headline': f"{rel['col1']} and {rel['col2']} are significantly associated (Cramer's V={rel['effect_size']}, p={'<0.001' if rel['p_value'] < 0.001 else round(rel['p_value'], 4)})",
                    'columns': [rel['col1'], rel['col2']],
                    'p_value': rel['p_value'],
                    'effect_size': rel['effect_size'],
                    'chart_data': None,
                })

        # From trends (significant direction changes)
        for trend in results.get('trends', []):
            if not trend: continue
            if trend.get('significant') and abs(trend.get('total_change_pct', 0)) > 10:
                candidates.append({
                    'type': 'trend',
                    'headline': f"{trend['measure_column']} is {trend['direction']} — {trend['total_change_pct']:+.1f}% change over {trend['data_points']} data points (R²={trend['r_squared']}, p={'<0.001' if trend['p_value'] < 0.001 else round(trend['p_value'], 4)})",
                    'columns': [trend['date_column'], trend['measure_column']],
                    'p_value': trend['p_value'],
                    'effect_size': min(abs(trend['total_change_pct']) / 100, 1),
                    'chart_data': None,
                })
            # Change points
            for cp in trend.get('change_points', []):
                candidates.append({
                    'type': 'change_point',
                    'headline': f"{trend['measure_column']} shows a significant shift at index {cp['index']} — mean changed from {round(cp['left_mean'], 2)} to {round(cp['right_mean'], 2)} ({cp['shift_pct']:+.1f}%)",
                    'columns': [trend['date_column'], trend['measure_column']],
                    'p_value': 0.01,
                    'effect_size': min(abs(cp['shift_pct']) / 100, 1),
                    'chart_data': None,
                })
            # Seasonality
            if trend and isinstance(trend.get('seasonality'), dict) and trend['seasonality'].get('detected'):
                s = trend['seasonality']
                candidates.append({
                    'type': 'seasonality',
                    'headline': f"{trend['measure_column']} shows recurring pattern with period={s['period']} (autocorrelation={s['strength']})",
                    'columns': [trend['date_column'], trend['measure_column']],
                    'p_value': 0.01,
                    'effect_size': s['strength'],
                    'chart_data': None,
                })

        # From majority detection
        for maj in results.get('majority', []):
            candidates.append({
                'type': 'majority',
                'headline': f"'{maj['dominant_category']}' dominates {maj['measure']} across {maj['dimension']} — {maj['dominant_share']}% of total ({maj['total_categories']} categories, total={round(maj['total_value'], 2)})",
                'columns': [maj['dimension'], maj['measure']],
                'p_value': 0.005,
                'effect_size': maj['dominant_share'] / 100,
                'chart_data': None,
            })

        # From key influencers
        for inf in results.get('key_influencers', [])[:3]:
            if inf['type'] == 'categorical':
                candidates.append({
                    'type': 'key_influencer',
                    'headline': f"{inf['influencer']} strongly influences {inf['target']} — '{inf['best_group']}' has {round(inf['best_rate'] * 100, 1)}% rate vs '{inf['worst_group']}' at {round(inf['worst_rate'] * 100, 1)}% ({inf['lift']}x lift, Cramér's V={round(inf['cramers_v'], 3)})",
                    'columns': [inf['target'], inf['influencer']],
                    'p_value': inf['p_value'],
                    'effect_size': inf['cramers_v'],
                    'chart_data': None,
                })
            else:
                candidates.append({
                    'type': 'key_influencer',
                    'headline': f"{inf['influencer']} correlates with {inf['target']} (r={inf['correlation']}, p={'<0.001' if inf['p_value'] < 0.001 else round(inf['p_value'], 4)})",
                    'columns': [inf['target'], inf['influencer']],
                    'p_value': inf['p_value'],
                    'effect_size': abs(inf.get('correlation', 0)),
                    'chart_data': None,
                })

        # From temporal patterns
        for pat in results.get('temporal_patterns', []):
            if pat['pattern_type'] == 'day_of_week':
                candidates.append({
                    'type': 'temporal_pattern',
                    'headline': f"{pat['measure']} peaks on {pat['best']['name']} (avg={pat['best']['mean']}) and dips on {pat['worst']['name']} (avg={pat['worst']['mean']})",
                    'columns': [pat['date_column'], pat['measure']],
                    'p_value': 0.05,
                    'effect_size': 0.3,
                    'chart_data': pat.get('chart_data'),
                })

        # From clusters
        clusters = results.get('clusters', {})
        if clusters.get('n_clusters', 0) >= 2:
            profiles = clusters.get('clusters', [])
            if len(profiles) >= 2:
                largest = profiles[0]
                smallest = profiles[-1]
                candidates.append({
                    'type': 'clustering',
                    'headline': f"Data naturally segments into {clusters['n_clusters']} clusters — largest cluster has {largest['size']} rows ({largest['pct']}%), smallest has {smallest['size']} rows ({smallest['pct']}%)",
                    'columns': clusters.get('columns_used', [])[:2],
                    'p_value': 0.01,
                    'effect_size': 0.4,
                    'chart_data': None,
                })

        # From outlier explanations
        for expl in results.get('outlier_explanations', []):
            top_reason = expl['explanations'][0] if expl['explanations'] else None
            if top_reason:
                candidates.append({
                    'type': 'outlier_explanation',
                    'headline': f"{expl['column']} outliers are {top_reason['overrepresentation']}x over-represented in {top_reason['dimension']}='{top_reason['category']}' ({top_reason['outlier_share']}% of outliers vs {top_reason['normal_share']}% of normal data)",
                    'columns': [expl['column'], top_reason['dimension']],
                    'p_value': 0.01,
                    'effect_size': min(top_reason['overrepresentation'] / 5, 1),
                    'chart_data': None,
                })

        # From forecasts
        for fc in results.get('forecasts', []):
            if fc['r_squared'] > 0.3:
                direction = 'increase' if fc['slope'] > 0 else 'decrease'
                next_val = fc['forecast_values'][0] if fc['forecast_values'] else fc['last_actual']
                candidates.append({
                    'type': 'forecast',
                    'headline': f"{fc['measure']} is forecast to {direction} — next period prediction: {round(next_val, 2)} (±{round(fc['std_error'] * 1.96, 2)}, R²={fc['r_squared']})",
                    'columns': [fc['date_column'], fc['measure']],
                    'p_value': 0.01,
                    'effect_size': fc['r_squared'],
                    'chart_data': None,
                })

        # From cross-correlations
        for cc in results.get('cross_correlations', []):
            candidates.append({
                'type': 'leading_indicator',
                'headline': f"{cc['leader']} leads {cc['follower']} by {cc['lag']} periods (r={cc['correlation_at_lag']} at lag vs r={cc['correlation_at_zero']} at zero — {round(cc['improvement'] * 100, 1)}% stronger)",
                'columns': [cc['leader'], cc['follower']],
                'p_value': 0.01,
                'effect_size': cc['correlation_at_lag'],
                'chart_data': None,
            })

        # From contribution analysis
        for contrib in results.get('contribution_analysis', [])[:2]:
            candidates.append({
                'type': 'contribution',
                'headline': f"'{contrib['top_contributor']}' is the top contributor to {contrib['measure']} by {contrib['dimension']} — {contrib['top_contribution_pct']}% of total ({round(contrib['total'], 2)})",
                'columns': [contrib['dimension'], contrib['measure']],
                'p_value': 0.005,
                'effect_size': contrib['top_contribution_pct'] / 100,
                'chart_data': contrib.get('chart_data'),
            })

        # Score = effect_size * -log10(p_value), higher = more important
        for c in candidates:
            p = max(c['p_value'], 1e-10)
            c['score'] = c['effect_size'] * (-np.log10(p))

        candidates.sort(key=lambda x: -x.get('score', 0))

        # DIVERSITY ENFORCEMENT: max 2 insights per type, prefer variety
        type_counts: dict[str, int] = {}
        diverse: list[dict] = []
        for c in candidates:
            t = c['type']
            if type_counts.get(t, 0) >= 2:
                continue  # Skip — already have 2 of this type
            # Also deduplicate by column overlap
            cols_key = tuple(sorted(c.get('columns', [])))
            already = any(tuple(sorted(d.get('columns', []))) == cols_key for d in diverse)
            if already:
                continue
            type_counts[t] = type_counts.get(t, 0) + 1
            diverse.append(c)
            if len(diverse) >= 8:
                break

        top = diverse
        for t in top:
            t.pop('score', None)
            t['p_value'] = round(t['p_value'], 6) if t['p_value'] > 0.0001 else t['p_value']
            t['effect_size'] = round(t['effect_size'], 4)
        return top

    # -- Chart helpers ---------------------------------------------------------

    def _scatter_chart(self, df: pd.DataFrame, col1: str, col2: str) -> dict:
        clean = df[[col1, col2]].dropna().head(200)
        if len(clean) == 0:
            return None
        return {
            'chart_type': 'scatter',
            'data': clean.round(4).to_dict(orient='records'),
            'x_key': col1,
            'y_keys': [col2],
            'title': f'{col1} vs {col2}',
        }

    def _cramers_v_label(self, v: float) -> str:
        if v >= 0.5:
            return 'strong'
        if v >= 0.3:
            return 'moderate'
        if v >= 0.1:
            return 'weak'
        return 'negligible'


auto_analyzer = AutoAnalyzer()
