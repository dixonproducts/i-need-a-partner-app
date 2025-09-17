import { 
  administrators, 
  adminUsers,
  companies,
  users, 
  partnerships, 
  partnershipMembers, 
  partnershipHistory,
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Administrator,
  type InsertAdministrator,
  type AdminUser,
  type InsertAdminUser,
  type Partnership,
  type InsertPartnership,
  type PartnershipMember
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Company methods
  createCompany(company: InsertCompany): Promise<Company>;
  getAllCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  getTeamsByCompany(companyId: string): Promise<any[]>;
  updateCompanyGroupSize(companyId: string, groupSize: number): Promise<Company>;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Administrator methods
  getActiveAdministrator(): Promise<Administrator | undefined>;
  createAdministrator(admin: InsertAdministrator): Promise<Administrator>;
  
  // Admin User methods  
  isAdminUser(email: string): Promise<boolean>;
  
  // Partnership methods
  createPartnership(partnership: InsertPartnership): Promise<Partnership>;
  addPartnershipMember(partnershipId: string, userId: string): Promise<PartnershipMember>;
  getPartnershipsByUserId(userId: string): Promise<Partnership[]>;
  getAllPartnerships(): Promise<(Partnership & { members: (PartnershipMember & { user: User })[] })[]>;
  addPartnershipHistory(user1Id: string, user2Id: string, partnershipId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.isActive, true)).orderBy(desc(companies.createdAt));
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByName(name: string): Promise<Company | undefined> {
    const matchingCompanies = await db.select().from(companies)
      .where(sql`LOWER(${companies.name}) LIKE LOWER(${'%' + name + '%'})`);
    return matchingCompanies[0] || undefined;
  }

  async getTeamsByCompany(companyId: string): Promise<any[]> {
    const teams = await db.select().from(partnerships)
      .where(eq(partnerships.companyId, companyId))
      .orderBy(partnerships.teamNumber);
    
    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        const members = await db.select().from(partnershipMembers)
          .innerJoin(users, eq(partnershipMembers.userId, users.id))
          .where(eq(partnershipMembers.partnershipId, team.id))
          .orderBy(asc(partnershipMembers.createdAt));
        
        const teamMembers = members.map(m => ({
          name: `${m.users.firstName} ${m.users.lastName}`,
          email: m.users.email,
          phone: m.users.phone,
          address: m.users.address,
          isLeader: m.users.id === team.leaderId
        }));

        return { ...team, members: teamMembers, memberCount: teamMembers.length };
      })
    );
    
    return teamsWithMembers.sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0));
  }

  async updateCompanyGroupSize(companyId: string, groupSize: number): Promise<Company> {
    const [company] = await db.update(companies)
      .set({ groupSize, groupSizeChangedAt: new Date() })
      .where(eq(companies.id, companyId)).returning();
    return company;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values(insertUser).returning();
      if (user.companyId) {
        await this.assignUserToTeam(user.id, user.companyId);
      }
      return user;
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.createdAt));
  }

  async getActiveAdministrator(): Promise<Administrator | undefined> {
    const [admin] = await db.select().from(administrators)
      .where(eq(administrators.isActive, true))
      .orderBy(desc(administrators.createdAt));
    return admin || undefined;
  }

  async createAdministrator(insertAdmin: InsertAdministrator): Promise<Administrator> {
    await db.update(administrators).set({ isActive: false }).where(eq(administrators.isActive, true));
    const [admin] = await db.insert(administrators).values({ ...insertAdmin, isActive: true }).returning();
    return admin;
  }

  async isAdminUser(email: string): Promise<boolean> {
    const [admin] = await db.select().from(adminUsers)
      .where(and(eq(adminUsers.email, email), eq(adminUsers.isActive, true)));
    return !!admin;
  }

  async createPartnership(insertPartnership: InsertPartnership): Promise<Partnership> {
    const [partnership] = await db.insert(partnerships).values(insertPartnership).returning();
    return partnership;
  }

  async addPartnershipMember(partnershipId: string, userId: string): Promise<PartnershipMember> {
    const [member] = await db.insert(partnershipMembers).values({ partnershipId, userId }).returning();
    return member;
  }

  async getPartnershipsByUserId(userId: string): Promise<Partnership[]> {
    const result = await db.select({ partnership: partnerships }).from(partnerships)
      .innerJoin(partnershipMembers, eq(partnerships.id, partnershipMembers.partnershipId))
      .where(eq(partnershipMembers.userId, userId))
      .orderBy(desc(partnerships.createdAt));
    return result.map(r => r.partnership);
  }

  async getAllPartnerships(): Promise<(Partnership & { members: (PartnershipMember & { user: User })[] })[]> {
    const partnershipsData = await db.select().from(partnerships).orderBy(partnerships.teamNumber);
    const partnershipsWithMembers = await Promise.all(
      partnershipsData.map(async (partnership) => {
        const members = await db.select().from(partnershipMembers)
          .innerJoin(users, eq(partnershipMembers.userId, users.id))
          .where(eq(partnershipMembers.partnershipId, partnership.id));
        return {
          ...partnership,
          members: members.map(m => ({ ...m.partnership_members, user: m.users }))
        };
      })
    );
    return partnershipsWithMembers;
  }

  async addPartnershipHistory(user1Id: string, user2Id: string, partnershipId: string): Promise<void> {
    await db.insert(partnershipHistory).values({ user1Id, user2Id, partnershipId });
  }

  private async assignUserToTeam(userId: string, companyId: string): Promise<void> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) throw new Error('Company not found');
    
    const groupSize = company.groupSize;
    const allUsers = await db.select().from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(asc(users.createdAt));
    
    const userPosition = allUsers.findIndex(user => user.id === userId) + 1;
    const leadershipTeamNumber = userPosition;
    const membershipTeamNumber = Math.floor((userPosition - 1) / (groupSize - 1)) + 1;
    
    if (membershipTeamNumber < leadershipTeamNumber) {
      await this.ensureUserInTeam(userId, membershipTeamNumber, companyId, false);
    }
    await this.ensureUserInTeam(userId, leadershipTeamNumber, companyId, true);
  }

  private async ensureUserInTeam(userId: string, teamNumber: number, companyId: string, isLeader: boolean): Promise<void> {
    const [existingTeam] = await db.select().from(partnerships)
      .where(and(eq(partnerships.companyId, companyId), eq(partnerships.teamNumber, teamNumber)));
    
    let teamId: string;
    if (!existingTeam) {
      const groupId = `MAKECENTSGRO-T${teamNumber}`;
      const [newTeam] = await db.insert(partnerships)
        .values({ groupId, companyId, teamNumber, leaderId: userId, status: 'filling' })
        .returning();
      teamId = newTeam.id;
    } else {
      teamId = existingTeam.id;
    }
    
    try {
      await db.insert(partnershipMembers).values({ partnershipId: teamId, userId });
    } catch (error) {
      console.log('User already a member of team', teamNumber);
    }
  }
}
