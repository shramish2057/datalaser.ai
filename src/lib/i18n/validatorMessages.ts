/**
 * Translates pipeline validator messages from English to the user's locale.
 * The pipeline always returns English messages. This function pattern-matches
 * them and returns the translated version using next-intl translation keys.
 */

type TranslateFunc = (key: string, params?: Record<string, string | number>) => string

const patterns: Array<{
  regex: RegExp
  key: string
  extract?: (m: RegExpMatchArray) => Record<string, string | number>
}> = [
  {
    regex: /^All fixable issues resolved\./,
    key: 'prep.allFixable',
  },
  {
    regex: /^(\d+) data characteristic\(s\) noted \(no action needed\)\./,
    key: 'prep.characteristicsNoted',
    extract: (m) => ({ count: Number(m[1]) }),
  },
  {
    regex: /^(\d+) issue\(s\) need attention\./,
    key: 'prep.issuesNeedAttention',
    extract: (m) => ({ count: Number(m[1]) }),
  },
  {
    regex: /^([\d,]+) rows x (\d+) columns\.$/,
    key: 'prep.rowsXColumns',
    extract: (m) => ({ rows: m[1], cols: Number(m[2]) }),
  },
  {
    regex: /^Mixed types: (\d+)% numeric, (\d+)% text$/,
    key: 'prep.mixedTypes',
    extract: (m) => ({ num: Number(m[1]), text: Number(m[2]) }),
  },
  {
    regex: /^(\d+) extreme outliers? \(([\d.]+)%\)\. Range: ([\d.]+) — ([\d.]+)$/,
    key: 'prep.extremeOutliers',
    extract: (m) => ({ count: Number(m[1]), pct: m[2], min: m[3], max: m[4] }),
  },
  {
    regex: /^No extreme outliers\. Range: ([\d.]+) — ([\d.]+)$/,
    key: 'prep.noOutliers',
    extract: (m) => ({ min: m[1], max: m[2] }),
  },
  {
    regex: /^(\d+) extreme outliers? \(([\d.]+)%\) — likely data errors$/,
    key: 'prep.extremeOutliersErrors',
    extract: (m) => ({ count: Number(m[1]), pct: m[2] }),
  },
  {
    regex: /^All ([\d,]+) values are unique — good ID column$/,
    key: 'prep.allUnique',
    extract: (m) => ({ count: m[1] }),
  },
  {
    regex: /^(\d+) duplicate values \(([\d.]+)%\) in ID column$/,
    key: 'prep.duplicateValues',
    extract: (m) => ({ count: Number(m[1]), pct: m[2] }),
  },
  {
    regex: /^Values are consistently typed$/,
    key: 'prep.consistentTypes',
  },
  {
    regex: /^Dataset is empty/,
    key: 'prep.datasetEmpty',
  },
  {
    regex: /^Dataset has ([\d,]+) rows$/,
    key: 'prep.datasetRows',
    extract: (m) => ({ count: m[1] }),
  },
  {
    regex: /^Dataset has only (\d+) rows/,
    key: 'prep.datasetFewRows',
    extract: (m) => ({ count: Number(m[1]) }),
  },
  {
    regex: /^Dataset has sufficient rows \(([\d,]+)\)/,
    key: 'prep.datasetSufficientRows',
    extract: (m) => ({ count: m[1] }),
  },
  {
    regex: /^Case variants detected/,
    key: 'prep.caseVariants',
  },
  {
    regex: /^Categorical values are consistent \((\d+) categories\)$/,
    key: 'prep.categoricalConsistent',
    extract: (m) => ({ count: Number(m[1]) }),
  },
  {
    regex: /^Only (\d+)% of values could be parsed as dates$/,
    key: 'prep.dateParseLow',
    extract: (m) => ({ pct: Number(m[1]) }),
  },
  {
    regex: /^More than half of dates are in the future/,
    key: 'prep.datesFuture',
  },
  {
    regex: /^Date column parses correctly \((\d+)% valid\)$/,
    key: 'prep.dateParseOk',
    extract: (m) => ({ pct: Number(m[1]) }),
  },
  {
    regex: /^All values match expected (.+) format$/,
    key: 'prep.formatValid',
    extract: (m) => ({ pattern: m[1] }),
  },
  {
    regex: /^(\d+) invalid (.+)s \(([\d.]+)%\) — column may contain wrong data$/,
    key: 'prep.formatInvalidErrors',
    extract: (m) => ({ count: Number(m[1]), pattern: m[2], pct: m[3] }),
  },
  {
    regex: /^(\d+) invalid (.+)s \(([\d.]+)%\)$/,
    key: 'prep.formatInvalid',
    extract: (m) => ({ count: Number(m[1]), pattern: m[2], pct: m[3] }),
  },
  {
    regex: /^([\d.]+)% of values are missing/,
    key: 'prep.nullValues',
    extract: (m) => ({ pct: m[1], count: 0 }),
  },
]

/**
 * Translate a single validator message.
 * Returns the translated string if a pattern matches, otherwise the original.
 */
export function translateValidatorMessage(msg: string, t: TranslateFunc): string {
  for (const { regex, key, extract } of patterns) {
    const match = msg.match(regex)
    if (match) {
      const params = extract ? extract(match) : {}
      return t(key, params)
    }
  }
  return msg
}

/**
 * Translate the full validation summary string.
 * The summary is composed of multiple sentences joined together.
 */
export function translateValidationSummary(summary: string, t: TranslateFunc): string {
  // Split by sentence boundaries and translate each part
  const parts = summary.split(/(?<=\.) /)
  return parts.map(part => translateValidatorMessage(part.trim(), t)).join(' ')
}
