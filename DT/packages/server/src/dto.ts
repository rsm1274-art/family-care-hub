import type { Person, Medication, Document, User, Household } from '@prisma/client';
import type { PersonDto, MedicationDto, DocumentDto, UserDto, DocumentType, UserRole } from '@familycarehub/shared-types';

export function toPersonDto(p: Person): PersonDto {
  return {
    id: p.id,
    name: p.name,
    dob: p.dob,
    bloodType: p.bloodType,
    insuranceProvider: p.insuranceProvider,
    policyNumber: p.policyNumber,
    medicalConditions: p.medicalConditions,
    allergies: p.allergies,
    primaryPhysician: p.primaryPhysician,
    physicianContact: p.physicianContact,
  };
}

export function toMedicationDto(m: Medication): MedicationDto {
  return {
    id: m.id,
    personId: m.personId,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    labelImageFile: m.labelImageFile,
  };
}

export function toDocumentDto(d: Document): DocumentDto {
  return {
    id: d.id,
    personId: d.personId,
    type: d.type as DocumentType,
    frontImageFile: d.frontImageFile,
  };
}

export function toUserDto(u: User, h: Household): UserDto {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role as UserRole,
    householdId: h.id,
    householdName: h.name,
    inviteCode: h.inviteCode,
  };
}
