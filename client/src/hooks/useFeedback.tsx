import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";

const FeedbackContext = createContext<(message: string) => void>(() => {});
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <FeedbackContext.Provider value={setMessage}>
      {children}
      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={() => setMessage("")}>
          {message}
        </Alert>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}
export const useFeedback = () => useContext(FeedbackContext);
