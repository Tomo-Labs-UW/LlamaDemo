export const simplifyText = async (rawText) => {
  if (!rawText?.trim()) {
    return "";
  }

  let response;
  try {
    response = await fetch("http://localhost:3001/api/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText })
    });
  } catch (error) {
    throw new Error(`Could not reach backend /api/simplify. ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messageParts = [data.error || `Simplify request failed (${response.status}).`];
    if (data.details) {
      messageParts.push(String(data.details));
    }
    throw new Error(messageParts.join(" "));
  }

  document.getElementById("output").textContent = data.simplified;

  return (data.simplified || rawText).trim();
};
