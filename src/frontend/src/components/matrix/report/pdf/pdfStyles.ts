import { StyleSheet } from '@react-pdf/renderer';

// Score color thresholds matching web scoreColor utility
export function pdfScoreColor(score: number): string {
  if (score >= 8) return '#16a34a'; // green
  if (score >= 5) return '#ca8a04'; // yellow
  return '#dc2626'; // red
}

export function pdfScoreBgColor(score: number): string {
  if (score >= 8) return '#dcfce7'; // green-100
  if (score >= 5) return '#fef9c3'; // yellow-100
  return '#fee2e2'; // red-100
}

export const styles = StyleSheet.create({
  // ── Page layout ──
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },

  // ── Header ──
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#6b7280',
  },

  // ── Section ──
  sectionHeading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    marginTop: 4,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 16,
  },

  // ── Text ──
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  smallText: {
    fontSize: 8,
    color: '#6b7280',
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 9,
    lineHeight: 1.4,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  // ── Table ──
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  tableCellRight: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },

  // ── Cards ──
  card: {
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  cardBody: {
    padding: 8,
  },

  // ── Score badges ──
  scoreBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    textAlign: 'center',
  },

  // ── Field pairs ──
  fieldRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  fieldLabel: {
    fontFamily: 'Courier',
    fontSize: 9,
    width: 120,
    color: '#374151',
  },
  fieldValue: {
    fontSize: 9,
    color: '#6b7280',
    flex: 1,
  },
});
