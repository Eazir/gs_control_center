export class InvalidCredentialsError extends Error {
  constructor(message = 'Credenciales inválidas.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends Error {
  constructor(public readonly lockedUntil: Date) {
    super(`Cuenta bloqueada temporalmente hasta ${lockedUntil.toISOString()}`);
    this.name = 'AccountLockedError';
  }
}

export class UserInactiveError extends Error {
  constructor(message = 'La cuenta de usuario no se encuentra activa.') {
    super(message);
    this.name = 'UserInactiveError';
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(message = 'Ya existe un usuario registrado con este correo electrónico.') {
    super(message);
    this.name = 'UserAlreadyExistsError';
  }
}

export class InvalidSessionError extends Error {
  constructor(message = 'Sesión inválida o expirada.') {
    super(message);
    this.name = 'InvalidSessionError';
  }
}

export class InvalidInvitationError extends Error {
  constructor(message = 'Invitación inválida o expirada.') {
    super(message);
    this.name = 'InvalidInvitationError';
  }
}
