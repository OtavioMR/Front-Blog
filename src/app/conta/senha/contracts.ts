export function passwordPayload(currentPassword: string, password: string, confirmation: string) {
  const encoder = new TextEncoder();
  if (!currentPassword || encoder.encode(currentPassword).length > 72) throw new Error("Informe a senha atual com até 72 bytes.");
  if (password.length < 8 || encoder.encode(password).length > 72) throw new Error("A nova senha deve ter pelo menos 8 caracteres e até 72 bytes em UTF-8.");
  if (password !== confirmation) throw new Error("A confirmação não corresponde à nova senha.");
  return { currentPassword, password };
}
