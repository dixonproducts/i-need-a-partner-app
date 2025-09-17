import type { Express } from "express";
import { createServer, type Server } from "http";
import { DatabaseStorage } from "./storage";
import { insertAdministratorSchema, insertUserSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

const storage = new DatabaseStorage();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Test endpoint to verify API connectivity
  app.get("/api/ping", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // Administrator routes
  app.post("/api/admin/setup", async (req, res) => {
    try {
      const adminData = insertAdministratorSchema.parse(req.body);
      const admin = await storage.createAdministrator(adminData);
      
      res.json({ success: true, admin });
    } catch (error) {
      console.error("Admin setup error:", error);
      res.status(400).json({ error: "Invalid administrator data" });
    }
  });

  app.get("/api/admin/current", async (req, res) => {
    try {
      const admin = await storage.getActiveAdministrator();
      if (!admin) {
        return res.status(404).json({ error: "No active administrator found" });
      }
      res.json(admin);
    } catch (error) {
      console.error("Get admin error:", error);
      res.status(500).json({ error: "Failed to get administrator" });
    }
  });

  app.post("/api/admin/verify", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if email matches admin
      const admin = await storage.getActiveAdministrator();
      const isValidAdmin = admin && admin.email.toLowerCase() === email.toLowerCase();
      
      res.json({ 
        success: true, 
        isAdmin: isValidAdmin,
        adminInfo: isValidAdmin ? { name: admin.name, email: admin.email } : null
      });
    } catch (error) {
      console.error("Admin verify error:", error);
      res.status(500).json({ error: "Failed to verify admin" });
    }
  });

  // Company routes
  app.post("/api/companies", async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      res.json({ success: true, company });
    } catch (error) {
      console.error("Create company error:", error);
      res.status(400).json({ error: "Invalid company data" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompanyById(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.get("/api/companies/name/:name", async (req, res) => {
    try {
      const company = await storage.getCompanyByName(req.params.name);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Get company by name error:", error);
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.patch("/api/companies/:id/group-size", async (req, res) => {
    try {
      const { groupSize } = req.body;
      if (!groupSize || groupSize < 2 || groupSize > 10) {
        return res.status(400).json({ error: "Group size must be between 2 and 10" });
      }
      
      const company = await storage.updateCompanyGroupSize(req.params.id, groupSize);
      res.json({ success: true, company });
    } catch (error) {
      console.error("Update group size error:", error);
      res.status(500).json({ error: "Failed to update group size" });
    }
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json({ success: true, user });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.get("/api/users/email/:email", async (req, res) => {
    try {
      const user = await storage.getUserByEmail(req.params.email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user by email error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Partnership/Team routes
  app.get("/api/partnerships", async (req, res) => {
    try {
      const partnerships = await storage.getAllPartnerships();
      res.json(partnerships);
    } catch (error) {
      console.error("Get partnerships error:", error);
      res.status(500).json({ error: "Failed to get partnerships" });
    }
  });

  app.get("/api/partnerships/user/:userId", async (req, res) => {
    try {
      const partnerships = await storage.getPartnershipsByUserId(req.params.userId);
      res.json(partnerships);
    } catch (error) {
      console.error("Get user partnerships error:", error);
      res.status(500).json({ error: "Failed to get user partnerships" });
    }
  });

  app.get("/api/teams/company/:companyId", async (req, res) => {
    try {
      const teams = await storage.getTeamsByCompany(req.params.companyId);
      res.json(teams);
    } catch (error) {
      console.error("Get company teams error:", error);
      res.status(500).json({ error: "Failed to get company teams" });
    }
  });

  // Check user status endpoint
  app.post("/api/user-status", async (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      let user;
      if (email) {
        user = await storage.getUserByEmail(email);
      } else if (firstName && lastName) {
        user = await storage.getUserByName(firstName, lastName);
      } else if (firstName) {
        user = await storage.getUserByName(firstName);
      }
      
      if (!user) {
        return res.json({ exists: false });
      }
      
      const partnerships = await storage.getPartnershipsByUserId(user.id);
      
      res.json({
        exists: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          address: user.address
        },
        partnerships: partnerships.length,
        partnershipDetails: partnerships
      });
    } catch (error) {
      console.error("User status error:", error);
      res.status(500).json({ error: "Failed to check user status" });
    }
  });

  const server = createServer(app);
  return server;
}
