import "dotenv/config";
// import { betterAuth } from "better-auth";
// import { Pool } from "pg";

// Mock Auth for bypassing login
export const auth = {
  api: {
    getSession: async (headers?: any) => {
      return {
        user: {
          id: "guest-user-id",
          email: "guest@example.com",
          name: "Guest User",
          image: null,
        },
        session: {
          user: {
            id: "guest-user-id",
            email: "guest@example.com",
            name: "Guest User",
            image: null,
          },
          userId: "guest-user-id"
        }
      };
    },
  },
};

