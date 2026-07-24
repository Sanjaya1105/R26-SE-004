// import React ,{ useState } from "react";
// import { useNavigate } from "react-router-dom";
// import CursorTracker from "./CursorTracker";
// import GazeTracker from "./GazeTracker2";

// function Module2() {
//   const navigate = useNavigate();
//   const [showConsentBox, setShowConsentBox] = useState(true);

//   const handleChoice = (type) => {
//   console.log(`Selected: ${type}`);
// };

// const cardStyle = {
//   backgroundColor: "#ffffff",
//   border: "1px solid #e3e3e3",
//   borderRadius: "12px",
//   padding: "12px",
//   boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
//   minHeight: "370px",
//   display: "flex",
//   flexDirection: "column",
// };

//   const imageStyle = {
//     width: "100%",
//     height: "180px",
//     objectFit: "cover",
//     borderRadius: "10px",
//     marginBottom: "10px",
//     filter: "grayscale(100%)",
//   };

//   const titleStyle = {
//     margin: 0,
//     fontWeight: "bold",
//     color: "#333",
//     fontSize: "16px",
//   };

//   const bodyStyle = {
//     margin: "6px 0 0 0",
//     color: "#555",
//     fontSize: "15px",
//     lineHeight: "1.6",
//   };

//   const verbalBoxStyle = {
//     width: "100%",
//     height: "180px",
//     borderRadius: "10px",
//     marginBottom: "10px",
//     backgroundColor: "#f4f6f8",
//     border: "1px solid #e3e3e3",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     textAlign: "center",
//     padding: "16px",
//     boxSizing: "border-box",
//     color: "#444",
//     fontSize: "16px",
//     lineHeight: "1.6",
//   };

//  const concepts = [
//   {
//     title: "Sunlight Absorption",
//     image: "/images/VisualVerbal Images/img1.png",
//     alt: "Sunlight Absorption",
//     visualText: "Show sunlight reaching the leaves of the plant.",
//     verbalText:
//       "The plant captures sunlight through its leaves. Sunlight provides the energy needed for photosynthesis.",
//     fact:
//       "Fact: Leaves contain chlorophyll, a green pigment that helps plants capture sunlight energy.",
//   },
//   {
//     title: "Water from Roots",
//     image: "/images/VisualVerbal Images/img2.png",
//     alt: "Water from Roots",
//     visualText: "Show roots absorbing water from the soil.",
//     verbalText:
//       "The roots absorb water from the soil. The water travels upward from the roots to the leaves.",
//     fact:
//       "Fact: Water moves through tiny tube-like structures inside the plant called xylem.",
//   },
//   {
//     title: "Carbon Dioxide Intake",
//     image: "/images/VisualVerbal Images/img3.png",
//     alt: "Carbon Dioxide Intake",
//     visualText: "Show carbon dioxide entering the leaf from the air.",
//     verbalText:
//       "The leaves take in carbon dioxide from the air through tiny openings called stomata.",
//     fact:
//       "Fact: Stomata can open and close to control gas exchange and water loss.",
//   },
//   {
//     title: "Food and Oxygen Output",
//     image: "/images/VisualVerbal Images/img4.png",
//     alt: "Food and Oxygen Output",
//     visualText: "Show glucose being made and oxygen being released.",
//     verbalText:
//       "The plant produces glucose as food. Oxygen is released into the air during photosynthesis.",
//     fact:
//       "Fact: Glucose gives the plant energy for growth, repair, and making new cells.",
//   },
//   {
//     title: "Chlorophyll",
//     image: "/images/VisualVerbal Images/img5.png",
//     alt: "Chlorophyll in leaves",
//     visualText: "Show chlorophyll inside the leaves capturing light energy.",
//     verbalText:
//       "Chlorophyll is the green pigment in leaves that captures energy from sunlight.",
//     fact:
//       "Fact: Chlorophyll is one reason many plant leaves appear green.",
//   },
//   {
//     title: "Stomata",
//     image: "/images/VisualVerbal Images/img6.png",
//     alt: "Stomata on leaf",
//     visualText: "Show tiny openings on the leaf surface where gases move in and out.",
//     verbalText:
//       "Stomata are tiny openings on leaves that allow carbon dioxide to enter and oxygen to leave.",
//     fact:
//       "Fact: Most stomata are found on the underside of leaves.",
//   },
//   {
//     title: "Glucose as Energy",
//     image: "/images/VisualVerbal Images/img7.png",
//     alt: "Glucose energy in plant",
//     visualText: "Show glucose being used by the plant as food energy.",
//     verbalText:
//       "Glucose is the sugar made during photosynthesis. The plant uses it as a source of energy.",
//     fact:
//       "Fact: Plants can also store extra glucose as starch for later use.",
//   },
//   {
//     title: "Oxygen Release",
//     image: "/images/VisualVerbal Images/img8.png",
//     alt: "Oxygen released from leaves",
//     visualText: "Show oxygen leaving the leaves and moving into the air.",
//     verbalText:
//       "Oxygen is released from the leaves after the plant uses sunlight, water, and carbon dioxide.",
//     fact:
//       "Fact: The oxygen released by plants supports humans, animals, and many other living things.",
//   },
// ];

//   return (
//     <div
//       style={{
//         display: "flex",
//         height: "100vh",
//         fontFamily: "sans-serif",
//         overflow: "hidden",
//         position: "relative",
//       }}
//     >
// {!showConsentBox && (
//   <>
//     <CursorTracker />
//     <GazeTracker />
//   </>
// )}
// {showConsentBox && (
//   <div
//     style={{
//       position: "fixed",
//       top: 0,
//       left: 0,
//       width: "100%",
//       height: "100%",
//       backgroundColor: "rgba(0, 0, 0, 0.55)",
//       display: "flex",
//       alignItems: "center",
//       justifyContent: "center",
//       zIndex: 9999,
//     }}
//   >
//     <div
//       style={{
//         backgroundColor: "#ffffff",
//         width: "620px",
//         maxWidth: "92%",
//         borderRadius: "18px",
//         padding: "30px",
//         boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
//         fontFamily: "sans-serif",
//       }}
//     >
//       <h2
//         style={{
//           marginTop: 0,
//           marginBottom: "12px",
//           color: "#222",
//           fontSize: "25px",
//           textAlign: "center",
//         }}
//       >
//         Cognitive Style Detection Module
//       </h2>

//       <p
//         style={{
//           color: "#444",
//           fontSize: "16px",
//           lineHeight: "1.7",
//           textAlign: "center",
//           marginBottom: "22px",
//         }}
//       >
//         In this module, we will analyze your learning preference and cognitive
//         style based on your interaction with visual and verbal learning
//         materials.
//       </p>

//       <div
//         style={{
//           backgroundColor: "#f4f6f8",
//           border: "1px solid #e0e0e0",
//           borderRadius: "12px",
//           padding: "18px",
//           marginBottom: "20px",
//         }}
//       >
//         <p
//           style={{
//             marginTop: 0,
//             marginBottom: "10px",
//             fontWeight: "bold",
//             color: "#333",
//             fontSize: "16px",
//           }}
//         >
//           Please read the following guidelines carefully:
//         </p>

//         <ul
//           style={{
//             margin: 0,
//             paddingLeft: "22px",
//             color: "#555",
//             fontSize: "15px",
//             lineHeight: "1.8",
//           }}
//         >
//           <li>
//             Your behavioral interaction data will be collected during this
//             activity.
//           </li>
//           <li>
//             This may include cursor movements, clicks, scrolling behavior, and
//             time spent on different sections.
//           </li>
//           <li>
//             Your gaze or attention behavior may be captured using your web
//             camera.
//           </li>
//           <li>
//             Please keep your face visible to the camera while completing the
//             module.
//           </li>
//           <li>
//             Try to interact naturally with the learning materials without
//             rushing.
//           </li>
//           <li>
//             Choose the learning format that feels more comfortable and useful
//             to you.
//           </li>
//           <li>
//             The collected data will be used only for cognitive style detection
//             and learning behavior analysis.
//           </li>
//         </ul>
//       </div>

//       <p
//         style={{
//           color: "#666",
//           fontSize: "14px",
//           lineHeight: "1.6",
//           textAlign: "center",
//           marginBottom: "24px",
//         }}
//       >
//         By continuing, you acknowledge that you understand the purpose of this
//         module and the types of data being collected.
//       </p>

//       <div style={{ display: "flex", justifyContent: "center" }}>
//         <button
//           onClick={() => setShowConsentBox(false)}
//           style={{
//             padding: "12px 28px",
//             border: "none",
//             borderRadius: "10px",
//             backgroundColor: "#778197",
//             color: "#fff",
//             fontSize: "16px",
//             fontWeight: "bold",
//             cursor: "pointer",
//             boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
//           }}
//         >
//           I Understand and Continue
//         </button>
//       </div>
//     </div>
//   </div>
// )}

//       {/* VISUAL SCREEN */}
//       <div
//         data-zone="VISUAL"
//         style={{
//           flex: 1,
//           backgroundColor: "#f4f6f8",
//           padding: "40px",
//           overflowY: "auto",
//           cursor: "pointer",
//         }}
//       >
//         <h2 style={{ textAlign: "center" }}>Visual</h2>

//         <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
//           <p
//             style={{
//               fontSize: "18px",
//               lineHeight: "1.8",
//               color: "#333",
//               margin: 0,
//             }}
//           >
//             <strong>Photosynthesis</strong> can be understood by following how
//             a plant uses sunlight, water, and carbon dioxide to make food and
//             release oxygen.
//           </p>

//           <div
//   style={{
//     display: "grid",
//     gridTemplateColumns: "repeat(2, 1fr)",
//     gap: "15px",
//   }}
// >
//   {concepts.map((item) => (
//     <div key={item.title} style={cardStyle}>
//       <img src={item.image} alt={item.alt} style={imageStyle} />

//       <p style={titleStyle}>{item.title}</p>

//       <p style={bodyStyle}>{item.visualText}</p>

//       <p
//         style={{
//           margin: "10px 0 0 0",
//           color: "#555",
//           fontSize: "14px",
//           lineHeight: "1.6",
//           backgroundColor: "#f4f6f8",
//           padding: "10px",
//           borderRadius: "8px",
//         }}
//       >
//         {item.fact}
//       </p>
//     </div>
//   ))}
// </div>

//           <div
//             style={{
//               display: "flex",
//               justifyContent: "center",
//               marginTop: "24px",
//             }}
//           >
//             <button
//               onClick={() => navigate("/geft")}
//               style={{
//                 padding: "12px 24px",
//                 border: "none",
//                 borderRadius: "10px",
//                 backgroundColor: "#778197",
//                 color: "#fff",
//                 fontSize: "16px",
//                 fontWeight: "bold",
//                 cursor: "pointer",
//                 boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
//               }}
//             >
//               Next
//             </button>
//           </div>
//         </div>

//         <p
//           style={{
//             textAlign: "center",
//             fontWeight: "bold",
//             color: "#555",
//             marginTop: 24,
//           }}
//         >
//           Choose if you prefer learning through images
//         </p>
//       </div>

//       {/* VERBAL SCREEN */}
//       <div
//         data-zone="TEXT"
//         style={{
//           flex: 1,
//           backgroundColor: "#ffffff",
//           padding: "40px",
//           overflowY: "auto",
//           cursor: "pointer",
//           borderLeft: "1px solid #ddd",
//         }}
//       >
//         <h2 style={{ textAlign: "center" }}>Verbal</h2>

//         <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
//           <p
//             style={{
//               fontSize: "18px",
//               lineHeight: "1.8",
//               color: "#333",
//               margin: 0,
//             }}
//           >
//             <strong>Photosynthesis</strong> can be understood by following how
//             a plant uses sunlight, water, and carbon dioxide to make food and
//             release oxygen.
//           </p>

//           <div
//   style={{
//     display: "grid",
//     gridTemplateColumns: "repeat(2, 1fr)",
//     gap: "15px",
//   }}
// >
//   {concepts.map((item) => (
//     <div key={item.title} style={cardStyle}>
//       <div style={verbalBoxStyle}>{item.verbalText}</div>

//       <p style={titleStyle}>{item.title}</p>

//       <p style={bodyStyle}>{item.verbalText}</p>

//       <p
//         style={{
//           margin: "10px 0 0 0",
//           color: "#555",
//           fontSize: "14px",
//           lineHeight: "1.6",
//           backgroundColor: "#f4f6f8",
//           padding: "10px",
//           borderRadius: "8px",
//         }}
//       >
//         {item.fact}
//       </p>
//     </div>
//   ))}
// </div>

//           <div
//             style={{
//               display: "flex",
//               justifyContent: "center",
//               marginTop: "24px",
//             }}
//           >
//             <button
//               onClick={() => navigate("/geft")}
//               style={{
//                 padding: "12px 24px",
//                 border: "none",
//                 borderRadius: "10px",
//                 backgroundColor: "#778197",
//                 color: "#fff",
//                 fontSize: "16px",
//                 fontWeight: "bold",
//                 cursor: "pointer",
//                 boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
//               }}
//             >
//               Next
//             </button>
//           </div>
//         </div>

//         <p
//           style={{
//             textAlign: "center",
//             fontWeight: "bold",
//             color: "#555",
//             marginTop: 24,
//           }}
//         >
//           Choose if you prefer learning through words
//         </p>
//       </div>
//     </div>
//   );
// }

// export default Module2;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CursorTracker from "./CursorTracker";
import GazeTracker from "./GazeTracker2";
import CalibrationScreen from "../Calibration/Calibration"; // Make sure the path is correct for your project

function Module2() {
  const navigate = useNavigate();
  // Replaced showConsentBox with a phase-based state to handle calibration
  const [appPhase, setAppPhase] = useState("INTRO");

  const handleChoice = (type) => {
    console.log(`Selected: ${type}`);
  };

  const cardStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e3e3e3",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    minHeight: "370px",
    display: "flex",
    flexDirection: "column",
  };

  const imageStyle = {
    width: "100%",
    height: "180px",
    objectFit: "cover",
    borderRadius: "10px",
    marginBottom: "10px",
    filter: "grayscale(100%)",
  };

  const titleStyle = {
    margin: 0,
    fontWeight: "bold",
    color: "#333",
    fontSize: "16px",
  };

  const bodyStyle = {
    margin: "6px 0 0 0",
    color: "#555",
    fontSize: "15px",
    lineHeight: "1.6",
  };

  const verbalBoxStyle = {
    width: "100%",
    height: "180px",
    borderRadius: "10px",
    marginBottom: "10px",
    backgroundColor: "#f4f6f8",
    border: "1px solid #e3e3e3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "16px",
    boxSizing: "border-box",
    color: "#444",
    fontSize: "16px",
    lineHeight: "1.6",
  };

  const concepts = [
    {
      title: "Sunlight Absorption",
      image: "/images/VisualVerbal Images/img1.png",
      alt: "Sunlight Absorption",
      visualText: "Show sunlight reaching the leaves of the plant.",
      verbalText:
        "The plant captures sunlight through its leaves. Sunlight provides the energy needed for photosynthesis.",
      fact: "Fact: Leaves contain chlorophyll, a green pigment that helps plants capture sunlight energy.",
    },
    {
      title: "Water from Roots",
      image: "/images/VisualVerbal Images/img2.png",
      alt: "Water from Roots",
      visualText: "Show roots absorbing water from the soil.",
      verbalText:
        "The roots absorb water from the soil. The water travels upward from the roots to the leaves.",
      fact: "Fact: Water moves through tiny tube-like structures inside the plant called xylem.",
    },
    {
      title: "Carbon Dioxide Intake",
      image: "/images/VisualVerbal Images/img3.png",
      alt: "Carbon Dioxide Intake",
      visualText: "Show carbon dioxide entering the leaf from the air.",
      verbalText:
        "The leaves take in carbon dioxide from the air through tiny openings called stomata.",
      fact: "Fact: Stomata can open and close to control gas exchange and water loss.",
    },
    {
      title: "Food and Oxygen Output",
      image: "/images/VisualVerbal Images/img4.png",
      alt: "Food and Oxygen Output",
      visualText: "Show glucose being made and oxygen being released.",
      verbalText:
        "The plant produces glucose as food. Oxygen is released into the air during photosynthesis.",
      fact: "Fact: Glucose gives the plant energy for growth, repair, and making new cells.",
    },
    {
      title: "Chlorophyll",
      image: "/images/VisualVerbal Images/img5.png",
      alt: "Chlorophyll in leaves",
      visualText: "Show chlorophyll inside the leaves capturing light energy.",
      verbalText:
        "Chlorophyll is the green pigment in leaves that captures energy from sunlight.",
      fact: "Fact: Chlorophyll is one reason many plant leaves appear green.",
    },
    {
      title: "Stomata",
      image: "/images/VisualVerbal Images/img6.png",
      alt: "Stomata on leaf",
      visualText: "Show tiny openings on the leaf surface where gases move in and out.",
      verbalText:
        "Stomata are tiny openings on leaves that allow carbon dioxide to enter and oxygen to leave.",
      fact: "Fact: Most stomata are found on the underside of leaves.",
    },
    {
      title: "Glucose as Energy",
      image: "/images/VisualVerbal Images/img7.png",
      alt: "Glucose energy in plant",
      visualText: "Show glucose being used by the plant as food energy.",
      verbalText:
        "Glucose is the sugar made during photosynthesis. The plant uses it as a source of energy.",
      fact: "Fact: Plants can also store extra glucose as starch for later use.",
    },
    {
      title: "Oxygen Release",
      image: "/images/VisualVerbal Images/img8.png",
      alt: "Oxygen released from leaves",
      visualText: "Show oxygen leaving the leaves and moving into the air.",
      verbalText:
        "Oxygen is released from the leaves after the plant uses sunlight, water, and carbon dioxide.",
      fact: "Fact: The oxygen released by plants supports humans, animals, and many other living things.",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* PHASE 1: INTRO / CONSENT */}
      {appPhase === "INTRO" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              width: "620px",
              maxWidth: "92%",
              borderRadius: "18px",
              padding: "30px",
              boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
              fontFamily: "sans-serif",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "12px",
                color: "#222",
                fontSize: "25px",
                textAlign: "center",
              }}
            >
              Cognitive Style Detection Module
            </h2>

            <p
              style={{
                color: "#444",
                fontSize: "16px",
                lineHeight: "1.7",
                textAlign: "center",
                marginBottom: "22px",
              }}
            >
              In this module, we will analyze your learning preference and cognitive
              style based on your interaction with visual and verbal learning
              materials.
            </p>

            <div
              style={{
                backgroundColor: "#f4f6f8",
                border: "1px solid #e0e0e0",
                borderRadius: "12px",
                padding: "18px",
                marginBottom: "20px",
              }}
            >
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "10px",
                  fontWeight: "bold",
                  color: "#333",
                  fontSize: "16px",
                }}
              >
                Please read the following guidelines carefully:
              </p>

              <ul
                style={{
                  margin: 0,
                  paddingLeft: "22px",
                  color: "#555",
                  fontSize: "15px",
                  lineHeight: "1.8",
                }}
              >
                <li>
                  Your behavioral interaction data will be collected during this
                  activity.
                </li>
                <li>
                  This may include cursor movements, clicks, scrolling behavior, and
                  time spent on different sections.
                </li>
                <li>
                  Your gaze or attention behavior may be captured using your web
                  camera.
                </li>
                <li>
                  Please keep your face visible to the camera while completing the
                  module.
                </li>
                <li>
                  Try to interact naturally with the learning materials without
                  rushing.
                </li>
                <li>
                  Choose the learning format that feels more comfortable and useful
                  to you.
                </li>
                <li>
                  The collected data will be used only for cognitive style detection
                  and learning behavior analysis.
                </li>
              </ul>
            </div>

            <p
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: "1.6",
                textAlign: "center",
                marginBottom: "24px",
              }}
            >
              By continuing, you acknowledge that you understand the purpose of this
              module and the types of data being collected.
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                // Move to calibration phase instead of immediately dismissing
                onClick={() => setAppPhase("CALIBRATE")}
                style={{
                  padding: "12px 28px",
                  border: "none",
                  borderRadius: "10px",
                  backgroundColor: "#778197",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                I Understand and Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: CALIBRATION */}
      {appPhase === "CALIBRATE" && (
        <CalibrationScreen
          onComplete={() => setAppPhase("TEST")} // Move to main module test content when done
        />
      )}

      {/* PHASE 3: MAIN MODULE TEST */}
      {appPhase === "TEST" && (
        <>
          <CursorTracker />
          <GazeTracker />

          {/* VISUAL SCREEN */}
          <div
            data-zone="VISUAL"
            style={{
              flex: 1,
              backgroundColor: "#f4f6f8",
              padding: "40px",
              overflowY: "auto",
              cursor: "pointer",
            }}
          >
            <h2 style={{ textAlign: "center" }}>Visual</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <p
                style={{
                  fontSize: "18px",
                  lineHeight: "1.8",
                  color: "#333",
                  margin: 0,
                }}
              >
                <strong>Photosynthesis</strong> can be understood by following how
                a plant uses sunlight, water, and carbon dioxide to make food and
                release oxygen.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                {concepts.map((item) => (
                  <div key={item.title} style={cardStyle}>
                    <img src={item.image} alt={item.alt} style={imageStyle} />

                    <p style={titleStyle}>{item.title}</p>

                    <p style={bodyStyle}>{item.visualText}</p>

                    <p
                      style={{
                        margin: "10px 0 0 0",
                        color: "#555",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        backgroundColor: "#f4f6f8",
                        padding: "10px",
                        borderRadius: "8px",
                      }}
                    >
                      {item.fact}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "24px",
                }}
              >
                <button
                  onClick={() => navigate("/visualverbalquestionnaire")}
                  style={{
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: "10px",
                    backgroundColor: "#778197",
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            <p
              style={{
                textAlign: "center",
                fontWeight: "bold",
                color: "#555",
                marginTop: 24,
              }}
            >
              Choose if you prefer learning through images
            </p>
          </div>

          {/* VERBAL SCREEN */}
          <div
            data-zone="TEXT"
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              padding: "40px",
              overflowY: "auto",
              cursor: "pointer",
              borderLeft: "1px solid #ddd",
            }}
          >
            <h2 style={{ textAlign: "center" }}>Verbal</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <p
                style={{
                  fontSize: "18px",
                  lineHeight: "1.8",
                  color: "#333",
                  margin: 0,
                }}
              >
                <strong>Photosynthesis</strong> can be understood by following how
                a plant uses sunlight, water, and carbon dioxide to make food and
                release oxygen.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                {concepts.map((item) => (
                  <div key={item.title} style={cardStyle}>
                    <div style={verbalBoxStyle}>{item.verbalText}</div>

                    <p style={titleStyle}>{item.title}</p>

                    <p style={bodyStyle}>{item.verbalText}</p>

                    <p
                      style={{
                        margin: "10px 0 0 0",
                        color: "#555",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        backgroundColor: "#f4f6f8",
                        padding: "10px",
                        borderRadius: "8px",
                      }}
                    >
                      {item.fact}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "24px",
                }}
              >
                <button
                  onClick={() => navigate("/visualverbalquestionnaire")}
                  style={{
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: "10px",
                    backgroundColor: "#778197",
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            <p
              style={{
                textAlign: "center",
                fontWeight: "bold",
                color: "#555",
                marginTop: 24,
              }}
            >
              Choose if you prefer learning through words
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default Module2;