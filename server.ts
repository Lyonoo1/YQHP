import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store';
import type { PublicPlayer, RoomMode, RoomStatus, RoomTeamSlot } from './src/shared/types';

interface AuthedRequest extends Request {
  user?: PublicPlayer | null;
  authToken?: string;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  req.authToken = token;
  req.user = store.getUserByToken(token);
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '请先登录后再进行操作' });
    return;
  }
  next();
}

function normalizeBasePath(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

  app.use(express.json({ limit: '100kb' }));

  const router = express.Router();
  router.use('/api', attachUser);

  // Bootstrap all daily data + current user
  router.get('/api/bootstrap', (req: AuthedRequest, res: Response) => {
    res.json(store.getBootstrap(req.user ?? null));
  });

  // Auth routes
  router.post('/api/auth/login', (req: AuthedRequest, res: Response) => {
    const { account, password } = req.body ?? {};
    const result = store.login(String(account ?? ''), String(password ?? ''));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, user: result.user });
  });

  router.post('/api/auth/quick-login', (req: AuthedRequest, res: Response) => {
    const { account, playerId } = req.body ?? {};
    const result = store.quickLogin(String(playerId ?? account ?? ''));
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, user: result.user });
  });

  router.post('/api/auth/register', (req: AuthedRequest, res: Response) => {
    const { nickname, account, password } = req.body ?? {};
    const result = store.register({
      nickname: String(nickname ?? ''),
      account: String(account ?? ''),
      password: String(password ?? ''),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ token: result.token, user: result.user });
  });

  router.post('/api/auth/logout', (req: AuthedRequest, res: Response) => {
    store.deleteSession(req.authToken);
    res.json({ ok: true });
  });

  // Rating & comments routes (Auth required)
  router.post('/api/players/:playerId/rate', requireAuth, (req: AuthedRequest, res: Response) => {
    const { stars, comment } = req.body ?? {};
    const result = store.ratePlayer(
      req.user!,
      String(req.params.playerId),
      Number(stars),
      typeof comment === 'string' ? comment : undefined,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  router.post('/api/players/:playerId/comments', requireAuth, (req: AuthedRequest, res: Response) => {
    const { content } = req.body ?? {};
    const result = store.addComment(req.user!, String(req.params.playerId), String(content ?? ''));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(store.getBootstrap(req.user!));
  });

  router.post('/api/comments/:commentId/like', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = store.toggleCommentLike(req.user!, String(req.params.commentId));
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  router.post('/api/comments/:commentId/replies', requireAuth, (req: AuthedRequest, res: Response) => {
    const { content, replyToUserId, replyToNickname } = req.body ?? {};
    const result = store.addReply(
      req.user!,
      String(req.params.commentId),
      String(content ?? ''),
      typeof replyToUserId === 'string' ? replyToUserId : undefined,
      typeof replyToNickname === 'string' ? replyToNickname : undefined,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(store.getBootstrap(req.user!));
  });

  router.post('/api/replies/:replyId/like', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = store.toggleReplyLike(req.user!, String(req.params.replyId));
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  // LoL-style Matchup Room routes (Auth required)
  router.post('/api/rooms', requireAuth, (req: AuthedRequest, res: Response) => {
    const { title, courtNote, mode, benchLimit } = req.body ?? {};
    const result = store.createRoom(req.user!, {
      title: String(title ?? ''),
      courtNote: typeof courtNote === 'string' ? courtNote : undefined,
      mode: mode as RoomMode,
      benchLimit: typeof benchLimit === 'number' ? benchLimit : Number(benchLimit ?? 0),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(store.getBootstrap(req.user!));
  });

  router.post('/api/rooms/:roomId/join', requireAuth, (req: AuthedRequest, res: Response) => {
    const { team, slotIndex } = req.body ?? {};
    const parsedSlot =
      slotIndex === undefined || slotIndex === null ? undefined : Number(slotIndex);
    const result = store.joinRoom(
      req.user!,
      String(req.params.roomId),
      team as RoomTeamSlot,
      parsedSlot,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  router.post('/api/rooms/:roomId/leave', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = store.leaveRoom(req.user!, String(req.params.roomId));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  router.patch('/api/rooms/:roomId/status', requireAuth, (req: AuthedRequest, res: Response) => {
    const { status } = req.body ?? {};
    const result = store.updateRoomStatus(
      req.user!,
      String(req.params.roomId),
      status as RoomStatus,
    );
    if (!result.ok) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  router.delete('/api/rooms/:roomId', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = store.deleteRoom(req.user!, String(req.params.roomId));
    if (!result.ok) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json(store.getBootstrap(req.user!));
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    router.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    router.use(express.static(distDir));
    router.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  if (BASE_PATH) {
    app.use(
      BASE_PATH,
      (req, res, next) => {
        if (req.originalUrl === BASE_PATH) {
          res.redirect(301, `${BASE_PATH}/`);
          return;
        }
        next();
      },
      router,
    );
  } else {
    app.use(router);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`园区虎扑 server listening on http://0.0.0.0:${PORT}${BASE_PATH || '/'}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
