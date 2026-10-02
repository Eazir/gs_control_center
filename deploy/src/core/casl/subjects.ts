import { InferSubjects } from '@casl/ability';

export class Lead {
  id?: string;
  closerId?: string;
  projectId?: string;
}

export class Project {
  id?: string;
  directorId?: string;
}

export class Sale {
  id?: string;
  closerId?: string;
  projectId?: string;
}

export class User {
  id?: string;
  role?: string;
}

export class Invitation {
  id?: string;
  invitedById?: string;
}

export type AppSubject =
  | InferSubjects<
      | typeof Lead
      | typeof Project
      | typeof Sale
      | typeof User
      | typeof Invitation,
      true
    >
  | 'Dashboard'
  | 'Closer'
  | 'all';

