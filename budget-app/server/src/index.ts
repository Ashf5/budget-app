import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { plaidRouter } from './routes/plaid';
import { saltEdgeRouter } from './routes/saltEdge';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/plaid', plaidRouter);
app.use('/salt-edge', saltEdgeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
