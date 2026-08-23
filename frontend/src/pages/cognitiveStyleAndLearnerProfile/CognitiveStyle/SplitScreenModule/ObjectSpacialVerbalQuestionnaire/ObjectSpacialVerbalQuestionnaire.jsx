// import React, { useState, useMemo } from "react";
// import { useLocation, useNavigate } from "react-router-dom";

// // Complete 45-item OSIVQ Questions
// const OSIVQ_QUESTIONS = [
//   { id: 1, text: "I was very good in 3D geometry as a student" },
//   { id: 2, text: "I have difficulty expressing myself in writing" },
//   { id: 3, text: "If I were asked to choose between engineering professions and visual arts, I would prefer engineering" },
//   { id: 4, text: "My verbal abilities would make a career in language arts relatively easy for me" },
//   { id: 5, text: "Architecture interests me more than painting" },
//   { id: 6, text: "My images are very colourful and bright" },
//   { id: 7, text: "I prefer schematic diagrams and sketches when reading a textbook instead of colourful and pictorial illustrations" },
//   { id: 8, text: "I tell jokes and stories better than most people" },
//   { id: 9, text: "Essay writing is difficult for me and I do not enjoy doing it at all" },
//   { id: 10, text: "My images are more like schematic representations of things and events rather than like detailed pictures" },
//   { id: 11, text: "When reading fiction, I usually form a clear and detailed mental picture of a scene or room that has been described" },
//   { id: 12, text: "If I were asked to choose among engineering professions, or visual arts, I would choose visual arts" },
//   { id: 13, text: "I have a photographic memory" },
//   { id: 14, text: "I can easily imagine and mentally rotate three-dimensional geometric figures" },
//   { id: 15, text: "I enjoy pictures with bright colours and unusual shapes like the ones in modern art" },
//   { id: 16, text: "My verbal skills are excellent" },
//   { id: 17, text: "When thinking about an abstract concept (or building), I imagine an abstract schematic building in my mind or its blueprint rather than a specific concrete building" },
//   { id: 18, text: "When entering a familiar store to get a specific item, I can easily picture the exact location of the target item, the shelf it stands on, how it is arranged and the surrounding articles" },
//   { id: 19, text: "Putting together furniture kits (e.g. a TV stand or a chair) is much easier for me when I have detailed verbal instructions than when I only have a diagram or picture" },
//   { id: 20, text: "My images are very vivid and photographic" },
//   { id: 21, text: "When explaining something, I would rather give verbal explanations than make drawings or sketches" },
//   { id: 22, text: "If someone were to give me two-digit numbers to add (e.g. 43 and 32) I would simply do the adding without visualizing the numbers" },
//   { id: 23, text: "My mental images of different objects very much resemble the size, shape and colour of actual objects that I have seen" },
//   { id: 24, text: "I usually do not try to visualize or sketch diagrams when reading a textbook" },
//   { id: 25, text: "I normally do not experience many spontaneous vivid images; I use my mental imagery mostly when attempting to solve some problems like the ones in mathematics" },
//   { id: 26, text: "When I imagine the face of a friend, I have a perfectly clear and bright image" },
//   { id: 27, text: "I have excellent abilities in technical graphics" },
//   { id: 28, text: "When remembering a scene, I use verbal descriptions rather than mental pictures" },
//   { id: 29, text: "I can easily remember a great deal of visual details that someone else might never notice. For example, I would just automatically take some things in, like what colour is a shirt someone wears or what colour are his/her shoes" },
//   { id: 30, text: "I can easily sketch a blueprint for a building I am familiar with" },
//   { id: 31, text: "In school, I had no problems with geometry" },
//   { id: 32, text: "I am good in playing spatial games involving constructing from blocks and paper (e.g. Lego, Tetris, Origami)" },
//   { id: 33, text: "Sometimes my images are so vivid and persistent that it is difficult to ignore them" },
//   { id: 34, text: "I can close my eyes and easily picture a scene that I have experienced" },
//   { id: 35, text: "I have better than average fluency in using words" },
//   { id: 36, text: "I would rather have a verbal description of an object or person than a picture" },
//   { id: 37, text: "I am always aware of sentence structure" },
//   { id: 38, text: "My images are more schematic than colourful and pictorial" },
//   { id: 39, text: "I enjoy being able to rephrase my thoughts in many ways for variety's sake in both writing and speaking" },
//   { id: 40, text: "I remember everything visually. I can recount what people wore to a dinner and I can talk about the way they sat and the way they looked probably in more detail than I could discuss what they said" },
//   { id: 41, text: "I sometimes have a problem expressing exactly what I want to say" },
//   { id: 42, text: "I find it difficult to imagine how a three-dimensional geometric figure would exactly look like when rotated" },
//   { id: 43, text: "My visual images are in my head all the time. They are just right there" },
//   { id: 44, text: "My graphic abilities would make a career in architecture relatively easy for me" },
//   { id: 45, text: "When I hear a radio announcer or a DJ I've never actually seen, I usually find myself picturing what he or she might look like" }
// ];

// // OSIVQ uses a 5-point scale (1 = Totally Disagree, 5 = Absolutely Agree)
// const scaleOptions = [1, 2, 3, 4, 5];

// export default function ObjectSpacialVerbalQuestionnaire() {
//   const BACKEND_URL = "http://localhost:4000/cognitive-style/osv-questions/create"; 
//   const location = useLocation();
//   const navigate = useNavigate();

//   // Catch the baton (data) passed from QuestionRunner
//   const visualTaskData = location.state?.visualTaskData || {};

//   // Decode Token to get UserId
//   const userPayload = useMemo(() => {
//     const token = localStorage.getItem("token");
//     if (!token) return null;
//     try {
//       return JSON.parse(atob(token.split(".")[1]));
//     } catch {
//       return null;
//     }
//   }, []);

//   // Initialize all answers as empty strings
//   const initialAnswers = Object.fromEntries(OSIVQ_QUESTIONS.map((_, index) => [index, ""]));
  
//   const [answers, setAnswers] = useState(initialAnswers);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   const handleChange = (questionIndex, value) => {
//     setAnswers((prev) => ({ ...prev, [questionIndex]: Number(value) }));
//   };

//   const isComplete = OSIVQ_QUESTIONS.every((_, index) => answers[index] !== "");

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");

//     if (!isComplete) {
//       setError(`Please answer all ${OSIVQ_QUESTIONS.length} questions before submitting.`);
//       window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
//       return;
//     }

//     // EXACT PAYLOAD FORMAT REQUIRED BY YOUR FASTAPI BACKEND
//     const payload = {
//       userId: userPayload?.id || "fallback-id",
//       answers: Object.keys(answers).map(key => ({
//           questionId: OSIVQ_QUESTIONS[key].id,
//           rawScore: answers[key]
//       })),
//       visualTaskData: visualTaskData 
//     };

//     try {
//       setLoading(true);
      
//       if (BACKEND_URL) {
//         await fetch(BACKEND_URL, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(payload)
//         });
//       } else {
//         console.log("BACKEND_URL is empty. Emulating success. Payload:", payload);
//         // Emulate network delay
//         await new Promise(resolve => setTimeout(resolve, 800));
//       }

//       setSuccess("Responses collected successfully.");
//       setTimeout(() => {
//         navigate("/geft"); // Update navigation as needed
//       }, 1500);

//     } catch (submitError) {
//       setError("Submission failed. Please check your connection and try again.");
//       console.error(submitError);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div
//       style={{
//         width: "100%",
//         minHeight: "100vh",
//         padding: "2rem",
//         background: "radial-gradient(circle at top right, #dbeafe, var(--background))",
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "flex-start",
//         boxSizing: "border-box",
//       }}
//     >
//       <div
//         className="glass-panel"
//         style={{
//           width: "100%",
//           maxWidth: "900px",
//           padding: "2.5rem",
//         }}
//       >
//         <div style={{ marginBottom: "2rem" }}>
//           <h1
//             className="gradient-text"
//             style={{
//               fontSize: "2rem",
//               fontWeight: 700,
//               marginBottom: "0.75rem",
//             }}
//           >
//             Cognitive Style Survey
//           </h1>

//           <p
//             style={{
//               color: "var(--text-muted)",
//               fontSize: "0.95rem",
//               lineHeight: 1.6,
//             }}
//           >
//             Please indicate your level of agreement with the following statements. Answer each question carefully to help us determine your cognitive style tendency (Object Visualizer, Spatial Visualizer, or Verbalizer).
//           </p>
//         </div>

//         <form
//           onSubmit={handleSubmit}
//           style={{
//             display: "flex",
//             flexDirection: "column",
//             gap: "1.5rem",
//           }}
//         >
//           {OSIVQ_QUESTIONS.map((q, index) => (
//             <div
//               key={q.id}
//               style={{
//                 padding: "1.25rem",
//                 borderRadius: "12px",
//                 backgroundColor: "var(--surface)",
//                 border: "1px solid #e2e8f0",
//                 boxShadow: "0 10px 20px -18px rgba(15, 23, 42, 0.35)",
//                 transition: "all 0.3s ease",
//               }}
//             >
//               <p
//                 style={{
//                   color: "var(--text)",
//                   fontSize: "1rem",
//                   fontWeight: 500,
//                   lineHeight: 1.6,
//                   marginBottom: "1rem",
//                 }}
//               >
//                 {index + 1}. {q.text}
//               </p>

//               <div
//                 style={{
//                   display: "flex",
//                   flexWrap: "wrap",
//                   gap: "0.75rem",
//                 }}
//               >
//                 {scaleOptions.map((option) => {
//                   const selected = answers[index] === option;

//                   return (
//                     <label
//                       key={option}
//                       style={{
//                         display: "inline-flex",
//                         alignItems: "center",
//                         justifyContent: "center",
//                         gap: "0.5rem",
//                         minWidth: "54px",
//                         padding: "0.65rem 1rem",
//                         borderRadius: "8px",
//                         border: selected
//                           ? "1px solid var(--primary)"
//                           : "1px solid var(--surface-light)",
//                         background: selected
//                           ? "rgba(37, 99, 235, 0.1)"
//                           : "#ffffff",
//                         color: selected ? "var(--primary)" : "var(--text-muted)",
//                         fontSize: "0.95rem",
//                         fontWeight: 500,
//                         cursor: "pointer",
//                         transition: "all 0.3s ease",
//                       }}
//                     >
//                       <input
//                         type="radio"
//                         name={`question-${index}`}
//                         value={option}
//                         checked={selected}
//                         onChange={(e) => handleChange(index, e.target.value)}
//                         style={{
//                           width: "16px",
//                           height: "16px",
//                           accentColor: "var(--primary)",
//                         }}
//                       />
//                       {option}
//                     </label>
//                   );
//                 })}
//               </div>
//             </div>
//           ))}

//           {error && (
//             <div className="error-message" style={{ marginBottom: 0, color: 'red' }}>
//               {error}
//             </div>
//           )}

//           {success && (
//             <div
//               style={{
//                 backgroundColor: "#ecfdf5",
//                 color: "var(--success, #059669)",
//                 padding: "0.75rem 1rem",
//                 borderRadius: "8px",
//                 fontSize: "0.875rem",
//                 border: "1px solid #a7f3d0",
//               }}
//             >
//               {success}
//             </div>
//           )}

//           <div
//             style={{
//               display: "flex",
//               justifyContent: "space-between",
//               alignItems: "center",
//               gap: "1rem",
//               paddingTop: "0.5rem",
//               flexWrap: "wrap",
//             }}
//           >
//             <p
//               style={{
//                 color: "var(--text-muted)",
//                 fontSize: "0.875rem",
//               }}
//             >
//               Scale: 1 = Totally Disagree, 5 = Absolutely Agree
//             </p>

//             <button
//               type="submit"
//               disabled={loading}
//               className="btn btn-primary"
//               style={{
//                 opacity: loading ? 0.6 : 1,
//                 cursor: loading ? "not-allowed" : "pointer",
//               }}
//             >
//               {loading ? "Submitting..." : "Submit Answers"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }
import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Complete 15-item VVQ Questions
const VVQ_QUESTIONS = [
  { id: 1, text: "I enjoy doing work that requires the use of words." },
  { id: 2, text: "My daydreams are sometimes so vivid I feel as though I actually experience the scene." },
  { id: 3, text: "I enjoy learning new words." },
  { id: 4, text: "I can easily think of synonyms for words." },
  { id: 5, text: "My powers of imagination are higher than average." },
  { id: 6, text: "I seldom dream." },
  { id: 7, text: "I read rather slowly." },
  { id: 8, text: "I cannot generate a mental picture of a friend's face when I close my eyes." },
  { id: 9, text: "I don't believe that anyone can think in terms of mental pictures." },
  { id: 10, text: "I prefer to read instructions about how to do something rather than have someone show me." },
  { id: 11, text: "My dreams are extremely vivid." },
  { id: 12, text: "I have better than average fluency in using words." },
  { id: 13, text: "My daydreams are rather indistinct and hazy." },
  { id: 14, text: "I spend very little time attempting to increase my vocabulary." },
  { id: 15, text: "My thinking often consists of mental pictures or images." }
];

// VVQ uses a True/False scale
const scaleOptions = ["True", "False"];

export default function VerbalizerVisualizerQuestionnaire() {
  // Update your endpoint URL as needed for the new VVQ structure
  const BACKEND_URL = "http://localhost:4000/cognitive-style/vvq-questions/create"; 
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
  const initialAnswers = Object.fromEntries(VVQ_QUESTIONS.map((_, index) => [index, ""]));
  
  const [answers, setAnswers] = useState(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (questionIndex, value) => {
    // Storing as string "True" or "False"
    setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const isComplete = VVQ_QUESTIONS.every((_, index) => answers[index] !== "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isComplete) {
      setError(`Please answer all ${VVQ_QUESTIONS.length} questions before submitting.`);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

    // EXACT PAYLOAD FORMAT REQUIRED BY YOUR FASTAPI BACKEND
    const payload = {
      userId: userPayload?.id || "fallback-id",
      answers: Object.keys(answers).map(key => ({
          questionId: VVQ_QUESTIONS[key].id,
          rawScore: answers[key] // Will send "True" or "False"
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
        navigate("/geft"); // Update navigation as needed
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
            Cognitive Style Survey
          </h1>

          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            Please indicate whether the following statements are True or False for you. Answer each question carefully to help us determine your cognitive style tendency (Verbal, Moderate/Intermediatory, or Visual).
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
          {VVQ_QUESTIONS.map((q, index) => (
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
                        minWidth: "80px",
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
            <div className="error-message" style={{ marginBottom: 0, color: 'red' }}>
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
              Please ensure all {VVQ_QUESTIONS.length} questions are answered.
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