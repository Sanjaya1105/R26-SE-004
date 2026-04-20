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
                  ? "3px solid #2563eb"
                  : "1px solid #ccc",
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
    gap: "20px",
  },

  section: {
    textAlign: "center",
  },

  complexImage: {
    maxWidth: "100%",
    height: "auto",
    border: "1px solid #ccc",
    borderRadius: "8px",
  },

  prompt: {
    marginTop: "10px",
    fontSize: "18px",
    fontWeight: "600",
  },

  optionsContainer: {
    display: "flex",
    justifyContent: "space-around",
    gap: "20px",
  },

  optionCard: {
    cursor: "pointer",
    padding: "10px",
    borderRadius: "10px",
    background: "#fff",
    textAlign: "center",
    transition: "0.2s",
  },

  optionLabel: {
    fontWeight: "bold",
    marginBottom: "6px",
  },

  optionImage: {
    width: "120px",
    height: "auto",
  },
};