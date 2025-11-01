import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Request logging FIRST
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Parse JSON body before auth handler
app.use(express.json());

// Test route
app.get("/test", (req, res) => {
  console.log("TEST ROUTE CALLED");
  res.json({ message: "Test OK" });
});

// Auth handler with error catching
const authHandler = toNodeHandler(auth);
app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    console.log("Auth request received:", {
      method: req.method,
      path: req.path,
    });
    await authHandler(req, res, next);
  } catch (error) {
    console.error("Auth handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal Server Error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
});

// Error handling middleware (for sync errors)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[ERROR MIDDLEWARE] Server Error:", err);
    res.status(500).json({
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  },
);

app.listen(port, () => {
  console.log(`Intercall app listening on port ${port}`);
});
