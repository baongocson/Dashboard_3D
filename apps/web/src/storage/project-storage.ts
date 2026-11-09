
import {
  db,
  type Project,
  type Session,
} from './db';

import {
  projectSchema,
  sessionSchema,
} from '@dashboard/contracts';

export async function saveProject(
  project: Project,
  session: Session,
): Promise<void> {
  const validProject = projectSchema.parse(project);
  const validSession = sessionSchema.parse(session);

  if (
    validProject.id !== validSession.projectId ||
    validProject.sessionId !== validSession.id ||
    validProject.datasetId !== validSession.datasetId
  ) {
    throw new Error('Project và session không khớp nhau');
  }

  await db.transaction(
    'rw',
    db.projects,
    db.sessions,
    async () => {
      await db.projects.put(validProject);
      await db.sessions.put(validSession);
    },
  );
}

export async function getProject(
  projectId: string,
): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

// Lấy session theo ID
export async function getSession(
  sessionId: string,
): Promise<Session | undefined> {
  return db.sessions.get(sessionId);
}

// Lấy project cùng session
export async function getProjectBundle(projectId: string) {
  const project = await db.projects.get(projectId);

  if (!project) {
    return undefined;
  }

  const session = await db.sessions.get(project.sessionId);

  return {
    project,
    session,
  };
}

export async function getProjectsByOwner(
  ownerId: string,
): Promise<Project[]> {
  return db.projects
    .where('ownerId')
    .equals(ownerId)
    .toArray();
}

// Xóa database khi cần reset môi trường thử nghiệm
export async function clearLocalDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    db.projects,
    db.sessions,
    async () => {
      await db.projects.clear();
      await db.sessions.clear();
    },
  );
}

export async function getSessionsByProject(
  projectId: string,
) {
  return db.sessions
    .where('projectId')
    .equals(projectId)
    .toArray();
}

export async function deleteProject(
  projectId: string,
): Promise<void> {
  const project = await db.projects.get(projectId);

  if (!project) {
    return;
  }

  await db.transaction(
    'rw',
    db.projects,
    db.sessions,
    async () => {
      await db.sessions
        .where('projectId')
        .equals(projectId)
        .delete();

      await db.projects.delete(projectId);
    },
  );
}
