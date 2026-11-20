import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  h1: { fontSize: 16, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#5B6B7C", marginBottom: 12 },
  h2: { fontSize: 12, marginTop: 12, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  p: { marginBottom: 4, lineHeight: 1.4 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottom: "1px solid #D5DEE7", paddingVertical: 3 },
});

export function ReportDocument({
  title,
  meta,
  summary,
  rows,
  note,
}: {
  title: string;
  meta: string;
  summary: string[];
  rows: { label: string; value: string }[];
  note: string;
}) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
        <Text style={styles.h2}>What happened</Text>
        {summary.map((line) => (
          <Text key={line} style={styles.p}>
            {line}
          </Text>
        ))}
        <Text style={styles.h2}>Figures</Text>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text>{row.label}</Text>
            <Text>{row.value}</Text>
          </View>
        ))}
        <Text style={styles.h2}>Manager&apos;s note</Text>
        <Text style={styles.p}>{note || "None."}</Text>
        <Text style={styles.meta}>Because. Synthetic demo. Figures are computed from the seeded book, not a live market.</Text>
      </Page>
    </Document>
  );
}
