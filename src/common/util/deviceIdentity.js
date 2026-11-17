/**
 * Utilidad unificada para la identidad del dispositivo en GeoZoone
 * Resuelve: Cliente/Propietario, IMEI, Teléfono del Cliente y Teléfono del Chip SIM
 * con seguridad estricta basada en roles (Superadmin / Revendedor / Cliente final).
 */

export const getDeviceClient = (device, groups = {}) => {
  if (!device) return '';
  const attr = device.attributes || {};
  if (attr.veiculo && attr.veiculo.cliente) return String(attr.veiculo.cliente).trim();
  if (attr.cliente) return String(attr.cliente).trim();
  if (attr.propietario) return String(attr.propietario).trim();
  if (attr.empresa) return String(attr.empresa).trim();
  if (device.groupId && groups[device.groupId] && groups[device.groupId].name) {
    return String(groups[device.groupId].name).trim();
  }
  return '';
};

export const getDeviceClientPhone = (device) => {
  if (!device) return '';
  const attr = device.attributes || {};
  if (attr.telefonoCliente) return String(attr.telefonoCliente).trim();
  if (attr.clientPhone) return String(attr.clientPhone).trim();
  if (attr.phoneOwner) return String(attr.phoneOwner).trim();
  if (attr.veiculo && attr.veiculo.telefono) return String(attr.veiculo.telefono).trim();
  if (attr.telefono) return String(attr.telefono).trim();
  return '';
};

export const getDeviceSimPhone = (device) => {
  if (!device) return '';
  const attr = device.attributes || {};
  if (device.phone) return String(device.phone).trim();
  if (attr.sim) return String(attr.sim).trim();
  if (attr.chip) return String(attr.chip).trim();
  if (attr.simCard) return String(attr.simCard).trim();
  return '';
};

export const isStaffUser = (user) => {
  if (!user) return false;
  if (user.administrator) return true;
  if ((user.userLimit || 0) !== 0) return true;
  const attr = user.attributes || {};
  if (attr.nivel === 2 || attr.nivel === '2' || attr.isReseller) return true;
  return false;
};

