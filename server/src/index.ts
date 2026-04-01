import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import transactionRoutes from "./routes/transactions";
import budgetItemRoutes from "./routes/budgetItems";
import ynabRoutes from "./routes/ynab";
import { errorHandler } from "./middleware/errorHandler";
import { startScheduler } from "./lib/ynabScheduler";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget-items", budgetItemRoutes);
app.use("/api/ynab", ynabRoutes);

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(__dirname, "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

// Error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});

export default app;
