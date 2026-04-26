import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const questions = [
  "I usually try to understand the meaning of what I learn rather than just memorising it.",
  "I try to relate new ideas to concepts I already know.",
  "When learning a new topic, I try to see how all the ideas fit together.",
  "I organise my study time carefully to make the best use of it.",
  "I follow a clear step-by-step approach when studying.",
  "I usually plan my work in advance rather than leaving it to the last minute.",
  "I focus mainly on memorising information rather than understanding it.",
  "I study only what is necessary to pass exams.",
  "Sometimes the material I study feels like unrelated pieces of information.",
  "I often feel overwhelmed by the amount of material I need to learn.",
  "I worry about whether I can manage my academic work effectively."
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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-lg md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Learner Profile Assessment
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Answer each question from 1 to 5. These responses can later be used
            to predict the learner profile: Organized Deep, Unorganized Deep,
            Unreflective, or Dissonant.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((question, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
            >
              <p className="mb-4 text-base font-medium text-slate-800">
                {index + 1}. {question}
              </p>

              <div className="flex flex-wrap gap-3">
                {scaleOptions.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${answers[index] === option
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                  >
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value={option}
                      checked={answers[index] === option}
                      onChange={(e) => handleChange(index, e.target.value)}
                      className="h-4 w-4"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-sm text-slate-500">
              Scale: 1 = strongly disagree, 5 = strongly agree
            </p>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Answers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}