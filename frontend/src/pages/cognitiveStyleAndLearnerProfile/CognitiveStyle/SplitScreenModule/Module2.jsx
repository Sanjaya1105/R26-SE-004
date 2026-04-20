import React from "react";
import CursorTracker from "./CursorTracker";
import GazeTracker from "./GazeTracker2";

function Module2() {
  const handleChoice = (type) => {
    alert(`You selected: ${type}`);
  };

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
      <CursorTracker />
      <GazeTracker />

      <div
        data-zone="VISUAL"
        onClick={() => handleChoice("Visual")}
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
            <strong>Photosynthesis</strong> can be understood visually by following how a plant uses
            sunlight, water, and carbon dioxide to make food.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <img
                src="/images/VisualVerbal Images/img1.png" // <-- your image path here
                alt="Sunlight Absorption"
                style={{
                  width: "100%",
                  height: "180px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  marginBottom: "10px",
                }}
              />
              <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>Sunlight Absorption</p>
              <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "15px", lineHeight: "1.6" }}>
                Show sunlight reaching the leaves of the plant.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <img
                src="/images/VisualVerbal Images/img2.png" // <-- your image path here
                alt="Water from Roots"
                style={{
                  width: "100%",
                  height: "180px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  marginBottom: "10px",
                }}
              />
              <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>Water from Roots</p>
              <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "15px", lineHeight: "1.6" }}>
                Show roots absorbing water from the soil.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <img
                src="/images/VisualVerbal Images/img3.png" // <-- your image path here
                alt="Carbon Dioxide Intake"
                style={{
                  width: "100%",
                  height: "180px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  marginBottom: "10px",
                }}
              />
              <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>Carbon Dioxide Intake</p>
              <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "15px", lineHeight: "1.6" }}>
                Show carbon dioxide entering the leaf from the air.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                padding: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <img
                src="/images/VisualVerbal Images/img4.png" // <-- your image path here
                alt="Food and Oxygen Output"
                style={{
                  width: "100%",
                  height: "180px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  marginBottom: "10px",
                }}
              />
              <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>Food and Oxygen Output</p>
              <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "15px", lineHeight: "1.6" }}>
                Show glucose being made and oxygen being released.
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <p style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#333" }}>
              Visual flow:
            </p>
            <ul style={{ margin: 0, paddingLeft: "22px", color: "#555", lineHeight: "1.7" }}>
              <li>Sunlight falls on the leaves</li>
              <li>Roots absorb water from the soil</li>
              <li>Leaves take in carbon dioxide</li>
              <li>The plant makes food using sunlight energy</li>
              <li>Oxygen is released into the air</li>
            </ul>
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

      <div
        data-zone="TEXT"
        onClick={() => handleChoice("Verbal")}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#333" }}>
  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "18px", lineHeight: "1.8" }}>
      <strong>Photosynthesis</strong> is the process by which green plants make their own food.
    </p>
  </div>

  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: "0 0 12px 0", fontWeight: "bold", fontSize: "18px" }}>
      Main idea
    </p>
    <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "0 0 14px 0" }} />

    <ul style={{ margin: 0, paddingLeft: "24px", fontSize: "18px", lineHeight: "1.8" }}>
      <li style={{ marginBottom: "10px" }}>Plants use sunlight as their main energy source.</li>
      <li style={{ marginBottom: "10px" }}>They take in carbon dioxide from the air.</li>
      <li style={{ marginBottom: "10px" }}>They absorb water from the soil through their roots.</li>
      <li style={{ marginBottom: "10px" }}>They produce glucose as food.</li>
      <li style={{ marginBottom: "0" }}>They release oxygen into the air.</li>
    </ul>
  </div>

  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: "0 0 12px 0", fontWeight: "bold", fontSize: "18px" }}>
      Step-by-step process
    </p>
    <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "0 0 14px 0" }} />

    <div style={{ fontSize: "18px", lineHeight: "1.8" }}>
      <p style={{ margin: "0 0 12px 0" }}>
        <strong>Step 1:</strong> The plant absorbs <strong>water</strong> from the soil through its roots.
      </p>
      <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "0 0 12px 0" }} />

      <p style={{ margin: "0 0 12px 0" }}>
        <strong>Step 2:</strong> The leaves take in <strong>carbon dioxide</strong> from the air.
      </p>
      <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "0 0 12px 0" }} />

      <p style={{ margin: "0 0 12px 0" }}>
        <strong>Step 3:</strong> <strong>Sunlight</strong> is captured by chlorophyll, the green pigment in leaves.
      </p>
      <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "0 0 12px 0" }} />

      <p style={{ margin: "0 0 12px 0" }}>
        <strong>Step 4:</strong> The plant uses sunlight energy to convert water and carbon dioxide into <strong>glucose</strong>.
      </p>
      <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "0 0 12px 0" }} />

      <p style={{ margin: 0 }}>
        <strong>Step 5:</strong> <strong>Oxygen</strong> is produced and released into the atmosphere.
      </p>
    </div>
  </div>

  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: "0 0 12px 0", fontWeight: "bold", fontSize: "18px" }}>
      Important parts involved
    </p>
    <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "0 0 14px 0" }} />

    <ul style={{ margin: 0, paddingLeft: "24px", fontSize: "18px", lineHeight: "1.8" }}>
      <li style={{ marginBottom: "10px" }}><strong>Roots</strong> - absorb water from the soil</li>
      <li style={{ marginBottom: "10px" }}><strong>Leaves</strong> - take in carbon dioxide and capture sunlight</li>
      <li style={{ marginBottom: "10px" }}><strong>Chlorophyll</strong> - helps trap sunlight energy</li>
      <li style={{ marginBottom: "0" }}><strong>Stomata</strong> - tiny openings in leaves for gas exchange</li>
    </ul>
  </div>

  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: "0 0 12px 0", fontWeight: "bold", fontSize: "18px" }}>
      Why photosynthesis is important
    </p>
    <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "0 0 14px 0" }} />

    <ul style={{ margin: 0, paddingLeft: "24px", fontSize: "18px", lineHeight: "1.8" }}>
      <li style={{ marginBottom: "10px" }}>It provides food for plants.</li>
      <li style={{ marginBottom: "10px" }}>It supports the food chain.</li>
      <li style={{ marginBottom: "10px" }}>It releases oxygen needed by humans and animals.</li>
      <li style={{ marginBottom: "0" }}>It helps maintain the balance of gases in the atmosphere.</li>
    </ul>
  </div>

  <div
    style={{
      backgroundColor: "#ffffff",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      padding: "18px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "18px", lineHeight: "1.8", color: "#555" }}>
      <strong>In short:</strong> sunlight + water + carbon dioxide = food for the plant + oxygen for the air.
    </p>
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
    </div>
  );
}

export default Module2;