import { View, Text, StyleSheet } from "react-native";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({
  title,
  subtitle,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginTop: 26,
    marginBottom: 14,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#888888",
    marginTop: 2,
  },
});
