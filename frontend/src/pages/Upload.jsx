import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getGatewayBaseUrl } from "../config/gateway";

const Upload = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxVideoSizeBytes = 40 * 1024 * 1024;

  const gatewayBaseUrl = getGatewayBaseUrl();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Please enter a valid name.");
      return;
    }

    if (!videoFile) {
      setMessage("Please select a video file.");
      return;
    }

    if (videoFile.size > maxVideoSizeBytes) {
      setMessage("Video size exceeds 40MB limit.");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("name", name);
      formData.append("video", videoFile);

      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.post(
        `${gatewayBaseUrl}/api/lessons/names-with-video`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      setMessage(response.data.message || "Submitted successfully");
      setName("");
      setVideoFile(null);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      const serverMessage =
        error.response?.data?.message || "Failed to submit name";
      setMessage(serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Upload Dashboard</h1>
      <button type="button" onClick={() => navigate("/uploads")}>
        View Uploads
      </button>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter name"
        />
        <label htmlFor="video">Video (Max 40MB)</label>
        <input
          id="video"
          name="video"
          type="file"
          accept="video/*"
          onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Upload;
