import { useEffect, useState } from "react";
import axios from "axios";

const UploadsView = () => {
  const [uploads, setUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const gatewayBaseUrl =
    import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const response = await axios.get(`${gatewayBaseUrl}/api/resources/uploads`);
        setUploads(response.data.data || []);
      } catch (error) {
        setMessage(error.response?.data?.message || "Failed to fetch uploads");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUploads();
  }, [gatewayBaseUrl]);

  if (isLoading) {
    return <p>Loading uploads...</p>;
  }

  return (
    <div>
      <h1>View Uploads</h1>
      {message && <p>{message}</p>}
      {uploads.length === 0 ? (
        <p>No uploads found.</p>
      ) : (
        uploads.map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "24px",
              border: "1px solid #ddd",
              padding: "16px",
            }}
          >
            <div>
              <h3>{item.name}</h3>
              <video controls width="100%" src={item.videoUrl}>
                <track kind="captions" />
              </video>
            </div>
            <div>
              <h3>Extracted Text</h3>
              <p>{item.transcriptText || "No transcript available."}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default UploadsView;
