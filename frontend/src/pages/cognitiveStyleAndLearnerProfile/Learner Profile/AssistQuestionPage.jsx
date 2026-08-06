// import React, { useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";

// const questions = [
//   "I usually try to understand the meaning of what I learn rather than just memorising it.",
//   "I try to relate new ideas to concepts I already know.",
//   "When learning a new topic, I try to see how all the ideas fit together.",
//   "I organise my study time carefully to make the best use of it.",
//   "I follow a clear step-by-step approach when studying.",
//   "I usually plan my work in advance rather than leaving it to the last minute.",
//   "I focus mainly on memorising information rather than understanding it.",
//   "I study only what is necessary to pass exams.",
//   "Sometimes the material I study feels like unrelated pieces of information.",
//   "I often feel overwhelmed by the amount of material I need to learn.",
//   "I worry about whether I can manage my academic work effectively."
// ];

// const scaleOptions = [1, 2, 3, 4, 5];


// export default function AssistQuestionPage() {
//   const initialAnswers = useMemo(
//     () => Object.fromEntries(questions.map((_, index) => [index, ""])),
//     []
//   );



//   const navigate = useNavigate();
//   const [answers, setAnswers] = useState(initialAnswers);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   const handleChange = (questionIndex, value) => {
//     setAnswers((prev) => ({ ...prev, [questionIndex]: Number(value) }));
//   };
//   const userPayload = useMemo(() => {
//     const token = localStorage.getItem("token");
//     if (!token) return null;

//     try {
//       console.log("Decoded user payload:", JSON.parse(atob(token.split(".")[1])));
//       return JSON.parse(atob(token.split(".")[1]));

//     } catch {
//       return null;
//     }
//   }, []);


//   const isComplete = questions.every((_, index) => answers[index] !== "");

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");

//     if (!isComplete) {
//       setError("Please answer all questions before submitting.");
//       return;
//     }

//     const payload = {
//       user_id: userPayload?.id || "hardcoded-user-id-123",
//       answers: questions.map((question, index) => ({
//         questionNumber: index + 1,
//         question,
//         value: answers[index]
//       }))
//     };

//     try {
//       setLoading(true);

//       await fetch("http://localhost:4000/cognitive-style/assist-questions/", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify(payload)
//       });

//       setSuccess("Responses collected successfully.");
//       console.log("Submitted payload:", payload);
//       navigate("/split-screen");
//     } catch (submitError) {
//       setError("Submission failed. Add your backend URL and try again.");
//       console.error(submitError);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//   <div
//     style={{
//       width: "100%",
//       minHeight: "100vh",
//       padding: "2rem",
//       background: "radial-gradient(circle at top right, #1e1b4b, var(--background))",
//       display: "flex",
//       justifyContent: "center",
//       alignItems: "flex-start",
//       boxSizing: "border-box",
//     }}
//   >
//     <div
//       className="glass-panel"
//       style={{
//         width: "100%",
//         maxWidth: "900px",
//         padding: "2.5rem",
//       }}
//     >
//       <div style={{ marginBottom: "2rem" }}>
//         <h1
//           className="gradient-text"
//           style={{
//             fontSize: "2rem",
//             fontWeight: 700,
//             marginBottom: "0.75rem",
//           }}
//         >
//           Learner Profile Assessment
//         </h1>

//         <p
//           style={{
//             color: "var(--text-muted)",
//             fontSize: "0.95rem",
//             lineHeight: 1.6,
//           }}
//         >
//           Answer each question from 1 to 5. These responses can later be used
//           to predict the learner profile: Organized Deep, Unorganized Deep,
//           Unreflective, or Dissonant.
//         </p>
//       </div>

//       <form
//         onSubmit={handleSubmit}
//         style={{
//           display: "flex",
//           flexDirection: "column",
//           gap: "1.5rem",
//         }}
//       >
//         {questions.map((question, index) => (
//           <div
//             key={index}
//             style={{
//               padding: "1.25rem",
//               borderRadius: "12px",
//               backgroundColor: "rgba(15, 23, 42, 0.45)",
//               border: "1px solid var(--surface-light)",
//               transition: "all 0.3s ease",
//             }}
//           >
//             <p
//               style={{
//                 color: "var(--text)",
//                 fontSize: "1rem",
//                 fontWeight: 500,
//                 lineHeight: 1.6,
//                 marginBottom: "1rem",
//               }}
//             >
//               {index + 1}. {question}
//             </p>

//             <div
//               style={{
//                 display: "flex",
//                 flexWrap: "wrap",
//                 gap: "0.75rem",
//               }}
//             >
//               {scaleOptions.map((option) => {
//                 const selected = answers[index] === option;

//                 return (
//                   <label
//                     key={option}
//                     style={{
//                       display: "inline-flex",
//                       alignItems: "center",
//                       justifyContent: "center",
//                       gap: "0.5rem",
//                       minWidth: "54px",
//                       padding: "0.65rem 1rem",
//                       borderRadius: "8px",
//                       border: selected
//                         ? "1px solid var(--primary)"
//                         : "1px solid var(--surface-light)",
//                       background: selected
//                         ? "rgba(79, 70, 229, 0.18)"
//                         : "rgba(15, 23, 42, 0.5)",
//                       color: selected ? "var(--text)" : "var(--text-muted)",
//                       fontSize: "0.95rem",
//                       fontWeight: 500,
//                       cursor: "pointer",
//                       transition: "all 0.3s ease",
//                     }}
//                   >
//                     <input
//                       type="radio"
//                       name={`question-${index}`}
//                       value={option}
//                       checked={selected}
//                       onChange={(e) => handleChange(index, e.target.value)}
//                       style={{
//                         width: "16px",
//                         height: "16px",
//                         accentColor: "var(--primary)",
//                       }}
//                     />
//                     {option}
//                   </label>
//                 );
//               })}
//             </div>
//           </div>
//         ))}

//         {error && (
//           <div className="error-message" style={{ marginBottom: 0 }}>
//             {error}
//           </div>
//         )}

//         {success && (
//           <div
//             style={{
//               backgroundColor: "rgba(16, 185, 129, 0.1)",
//               color: "var(--success)",
//               padding: "0.75rem 1rem",
//               borderRadius: "8px",
//               fontSize: "0.875rem",
//               border: "1px solid rgba(16, 185, 129, 0.2)",
//             }}
//           >
//             {success}
//           </div>
//         )}

//         <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             gap: "1rem",
//             paddingTop: "0.5rem",
//             flexWrap: "wrap",
//           }}
//         >
//           <p
//             style={{
//               color: "var(--text-muted)",
//               fontSize: "0.875rem",
//             }}
//           >
//             Scale: 1 = strongly disagree, 5 = strongly agree
//           </p>

//           <button
//             type="submit"
//             disabled={loading}
//             className="btn btn-primary"
//             style={{
//               opacity: loading ? 0.6 : 1,
//               cursor: loading ? "not-allowed" : "pointer",
//             }}
//           >
//             {loading ? "Submitting..." : "Submit Answers"}
//           </button>
//         </div>
//       </form>
//     </div>
//   </div>
// );
// }


import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// These are the exact 18 items from the short ASSIST scale
const questions = [
  "I often have trouble in making sense of the things I have to remember.",
  "When I'm reading an article or a book, I try to find out for myself exactly what the author means.",
  "I organize my study time carefully to make the best use of it.",
  "There's not much of the work here that I find interesting or relevant.",
  "I work steadily through the term or semester, rather than leave it all until the last minute.",
  "Before tackling a problem or assignment, I first try to work out what lies behind it.",
  "I'm pretty good at getting down to work whenever I need to.",
  "Much of what I'm studying makes little sense: it's like unrelated bits and pieces.",
  "I put a lot of effort into studying because I'm determined to do well.",
  "When I'm working on a new topic, I try to see in my own mind how all the ideas fit together.",
  "I don't find it at all difficult to motivate myself.",
  "Often I find myself questioning things I hear in lectures or read in books.",
  "I think I'm quite systematic and organised when it comes to revising for exams.",
  "Often I feel I'm drowning in the sheer amount of material we're having to cope with.",
  "Ideas in course books or articles often set me off on long chains of thought of my own.",
  "I'm not really sure what's important in lectures, so I try to get down all I can.",
  "When I read, I examine the details carefully to see how they fit in with what's being said.",
  "I often worry about whether I'll be able to cope with the work properly."
];

const scaleOptions = [1, 2, 3, 4, 5];

export default function AssistQuestionPage() {
  const initialAnswers = useMemo(
    () => Object.fromEntries(questions.map((_, index) => [index, ""])),
    []
  );

  const navigate = useNavigate();
  const [answers, setAnswers] = useState(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (questionIndex, value) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: Number(value) }));
  };

  const userPayload = useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      console.log("Decoded user payload:", JSON.parse(atob(token.split(".")[1])));
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  }, []);

  const isComplete = questions.every((_, index) => answers[index] !== "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isComplete) {
      setError("Please answer all questions before submitting.");
      return;
    }

    const payload = {
      user_id: userPayload?.id || "hardcoded-user-id-123",
      answers: questions.map((question, index) => ({
        questionNumber: index + 1,
        question,
        value: answers[index]
      }))
    };

    try {
      setLoading(true);

      await fetch("http://localhost:4000/cognitive-style/assist-questions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      setSuccess("Responses collected successfully.");
      console.log("Submitted payload:", payload);
      navigate("/split-screen");
    } catch (submitError) {
      setError("Submission failed. Add your backend URL and try again.");
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
            Learner Profile Assessment
          </h1>

          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            Answer each question based on your actual ways of studying. 
            These responses will be used to calculate your dominant learner profile: 
            Deep Approach, Strategic Approach, or Surface Approach.
          </p>

          {/* New Scale Description Box */}
          <div 
            style={{
              backgroundColor: "rgba(37, 99, 235, 0.05)",
              borderLeft: "4px solid var(--primary)",
              padding: "1.25rem",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.5rem", color: "var(--text)", fontSize: "1rem" }}>
              Rating Scale Guide:
            </strong>
            <ul style={{ 
              margin: 0, 
              paddingLeft: "1.25rem", 
              color: "var(--text-muted)", 
              fontSize: "0.95rem", 
              lineHeight: 1.6,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.5rem"
            }}>
              <li><strong>1</strong> = Disagree</li>
              <li><strong>2</strong> = Disagree somewhat</li>
              <li><strong>3</strong> = Unsure</li>
              <li><strong>4</strong> = Agree somewhat</li>
              <li><strong>5</strong> = Agree</li>
            </ul>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {questions.map((question, index) => (
            <div
              key={index}
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
                {index + 1}. {question}
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
                color: "var(--success)",
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
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "1rem",
              paddingTop: "0.5rem",
            }}
          >
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