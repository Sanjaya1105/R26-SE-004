import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Complete 24-item AHS Questions
const AHS_QUESTIONS = [
  { id: 1, text: "Everything in the universe is somehow related to each other." },
  { id: 2, text: "Nothing is unrelated." },
  { id: 3, text: "Everything in the world is intertwined in a causal relationship." },
  { id: 4, text: "Even a small change in any element of the universe can lead to significant alterations in other elements." },
  { id: 5, text: "Any phenomenon has numerous numbers of causes, although some of the causes are not known." },
  { id: 6, text: "Any phenomenon entails a numerous number of consequences, although some of them may not be known." },
  { id: 7, text: "It is more desirable to take the middle ground than go to extremes." },
  { id: 8, text: "When disagreement exists among people, they should search for ways to compromise and embrace everyone's opinions." },
  { id: 9, text: "It is more important to find a point of compromise than to debate who is right/wrong, when one's opinions conflict with other's opinions." },
  { id: 10, text: "It is desirable to be in harmony, rather than in discord, with others of different opinions than one's own." },
  { id: 11, text: "Choosing a middle ground in an argument should be avoided." }, 
  { id: 12, text: "We should avoid going to extremes." },
  { id: 13, text: "Every phenomenon in the world moves in predictable directions." }, 
  { id: 14, text: "A person who is currently living a successful life will continue to stay successful." }, 
  { id: 15, text: "An individual who is currently honest will stay honest in the future." }, 
  { id: 16, text: "If an event is moving toward a certain direction, it will continue to move toward that direction." }, 
  { id: 17, text: "Current situations can change at any time." },
  { id: 18, text: "Future events are predictable based on present situations." }, 
  { id: 19, text: "The whole, rather than its parts, should be considered in order to understand a phenomenon." },
  { id: 20, text: "It is more important to pay attention to the whole than its parts." },
  { id: 21, text: "The whole is greater than the sum of its parts." },
  { id: 22, text: "It is more important to pay attention to the whole context rather than the details." },
  { id: 23, text: "It is not possible to understand the parts without considering the whole picture." },
  { id: 24, text: "We should consider the situation a person is faced with, as well as his/her personality, in order to understand one's behavior." }
];

const scaleOptions = [1, 2, 3, 4, 5, 6, 7];

export default function AHSQuestionnaire() {
  const BACKEND_URL = "http://localhost:4000/cognitive-style/anaylticwholistic/ahsquestionnaire"; 
  const location = useLocation();
  const navigate = useNavigate();

  // Catch the baton (data) passed from QuestionRunner
  const visualTaskData = location.state?.visualTaskData || {};

  // Decode Token to get UserId
  const userPayload = useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  }, []);

  // Initialize all answers as empty strings
  const initialAnswers = Object.fromEntries(AHS_QUESTIONS.map((_, index) => [index, ""]));
  
  const [answers, setAnswers] = useState(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (questionIndex, value) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: Number(value) }));
  };

  const isComplete = AHS_QUESTIONS.every((_, index) => answers[index] !== "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isComplete) {
      setError("Please answer all 24 questions before submitting.");
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

    // EXACT PAYLOAD FORMAT REQUIRED BY YOUR FASTAPI BACKEND
    const payload = {
      userId: userPayload?.id || "fallback-id",
      answers: Object.keys(answers).map(key => ({
          questionId: AHS_QUESTIONS[key].id,
          rawScore: answers[key]
      })),
      visualTaskData: visualTaskData 
    };

    try {
      setLoading(true);
      
      if (BACKEND_URL) {
        await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        console.log("BACKEND_URL is empty. Emulating success. Payload:", payload);
        // Emulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setSuccess("Responses collected successfully.");
      setTimeout(() => {
        navigate("/course");
      }, 1500);

    } catch (submitError) {
      setError("Submission failed. Please check your connection and try again.");
      console.error(submitError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "2rem",
        background: "radial-gradient(circle at top right, #dbeafe, var(--background))",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        boxSizing: "border-box",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "900px",
          padding: "2.5rem",
        }}
      >
        <div style={{ marginBottom: "2rem" }}>
          <h1
            className="gradient-text"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
            }}
          >
            Thinking Style Survey
          </h1>

          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            Please indicate your level of agreement with the following statements. Answer each question carefully to help us determine your cognitive style tendency (Analytic vs. Holistic).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {AHS_QUESTIONS.map((q, index) => (
            <div
              key={q.id}
              style={{
                padding: "1.25rem",
                borderRadius: "12px",
                backgroundColor: "var(--surface)",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 20px -18px rgba(15, 23, 42, 0.35)",
                transition: "all 0.3s ease",
              }}
            >
              <p
                style={{
                  color: "var(--text)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  lineHeight: 1.6,
                  marginBottom: "1rem",
                }}
              >
                {index + 1}. {q.text}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                {scaleOptions.map((option) => {
                  const selected = answers[index] === option;

                  return (
                    <label
                      key={option}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        minWidth: "54px",
                        padding: "0.65rem 1rem",
                        borderRadius: "8px",
                        border: selected
                          ? "1px solid var(--primary)"
                          : "1px solid var(--surface-light)",
                        background: selected
                          ? "rgba(37, 99, 235, 0.1)"
                          : "#ffffff",
                        color: selected ? "var(--primary)" : "var(--text-muted)",
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={selected}
                        onChange={(e) => handleChange(index, e.target.value)}
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "var(--primary)",
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="error-message" style={{ marginBottom: 0 }}>
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                backgroundColor: "#ecfdf5",
                color: "var(--success, #059669)",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                border: "1px solid #a7f3d0",
              }}
            >
              {success}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              paddingTop: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Scale: 1 = Strongly Disagree, 7 = Strongly Agree
            </p>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Submitting..." : "Submit Answers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}