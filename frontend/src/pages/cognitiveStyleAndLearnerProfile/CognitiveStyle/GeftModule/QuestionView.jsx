import React from "react";

export default function QuestionView({
  question,
  selectedAnswer,
  onSelect,
}) {
  if (!question) return null;

  return (
    <div style={styles.container}>
      {/* Complex Figure */}
      <div style={styles.section}>
        <img
          src={question.complexImage}
          alt="complex"
          style={styles.complexImage}
        />
        <p style={styles.prompt}>
          Find Simple Form "{question.target}"
        </p>
      </div>

      {/* Options */}
      <div style={styles.optionsContainer}>
        {question.options.map((opt) => (
          <div
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            style={{
  ...styles.optionCard,
  border:
    selectedAnswer === opt.id
      ? "2px solid #2563eb"
      : "1px solid #e2e8f0",
  background:
    selectedAnswer === opt.id ? "#eff6ff" : "#ffffff",
}}
          >
            <p style={styles.optionLabel}>{opt.id}</p>

            <img
              src={opt.image}
              alt={opt.id}
              style={styles.optionImage}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "30px",
  },

  section: {
    width: "100%",
    maxWidth: "600px",
    textAlign: "center",
  },

  complexImage: {
    width: "100%",
    maxHeight: "300px",
    objectFit: "contain",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "10px",
    background: "#f9fafb",
  },

  prompt: {
    marginTop: "14px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#1e293b",
  },

  optionsContainer: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "24px",
    width: "100%",
  },

  optionCard: {
    width: "140px",
    cursor: "pointer",
    padding: "14px",
    borderRadius: "14px",
    background: "#ffffff",
    textAlign: "center",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },

  optionLabel: {
    fontWeight: "600",
    fontSize: "16px",
    marginBottom: "8px",
    color: "#0f172a",
  },

  optionImage: {
    width: "100%",
    height: "90px",
    objectFit: "contain",
  },
};