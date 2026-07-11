import { BadRequestException } from '@nestjs/common';

/**
 * FR-CUS-02: normalize Nigerian phone formats to E.164 (+234...).
 * Accepts: 08031234567, 803 123 4567, +2348031234567, 2348031234567.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  let rest: string;
  if (digits.startsWith('+234')) rest = digits.slice(4);
  else if (digits.startsWith('234')) rest = digits.slice(3);
  else if (digits.startsWith('0')) rest = digits.slice(1);
  else if (/^[789]\d{9}$/.test(digits)) rest = digits;
  else throw new BadRequestException(`"${input}" is not a valid Nigerian phone number`);

  if (!/^[789]\d{9}$/.test(rest)) {
    throw new BadRequestException(`"${input}" is not a valid Nigerian phone number (expect 11 digits starting 070/080/081/090/091…)`);
  }
  return `+234${rest}`;
}

/** Lenient variant for search inputs — returns null instead of throwing. */
export function tryNormalizePhone(input: string): string | null {
  try {
    return normalizePhone(input);
  } catch {
    return null;
  }
}
