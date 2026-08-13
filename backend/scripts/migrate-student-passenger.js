const { Client } = require('pg');

async function migrate() {
  const connectionString = "postgresql://postgres.hlmzibohzqmorzcltxvz:Q%3F745p!mLEbuG*6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    console.log("Renaming ENUM value...");
    await client.query(`ALTER TYPE "users_role_enum" RENAME VALUE 'student' TO 'passenger';`);
    console.log("ENUM renamed successfully.");

    console.log("Renaming column in attendance table...");
    await client.query(`ALTER TABLE "attendance" RENAME COLUMN "student_id" TO "passenger_id";`);
    console.log("Column renamed successfully.");

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
