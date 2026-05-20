import express from 'express';
import cors from 'cors';
import jobsRouter from './routes/jobs.js';
import groupsRouter from './routes/groups.js';
import dependenciesRouter from './routes/dependencies.js';
import graphRouter from './routes/graph.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/jobs', jobsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/dependencies', dependenciesRouter);
app.use('/api/graph', graphRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
