const { storage } = require('./server/storage');

async function testCleanup() {
  console.log('🧪 Testing office_credentials cleanup functionality...');
  
  // Check initial count
  const initialCount = await storage.db
    .select({ count: sql`COUNT(*)` })
    .from(storage.officeCredentials)
    .where(eq(storage.officeCredentials.source, 'renewal'));
  
  console.log(`📊 Initial credential count: ${initialCount[0].count}`);
  
  // Create a test credential to trigger cleanup
  console.log('📝 Creating test credential to trigger cleanup...');
  
  const testCredential = {
    username: 'test_cleanup_' + Date.now(),
    password: 'test_password',
    source: 'renewal',
    status: 'completed',
    generatedAt: new Date(),
    sistemaId: null
  };
  
  const created = await storage.createOfficeCredentials(testCredential);
  console.log(`✅ Test credential created with ID: ${created.id}`);
  
  // Check count after creation
  const afterCount = await storage.db
    .select({ count: sql`COUNT(*)` })
    .from(storage.officeCredentials)
    .where(eq(storage.officeCredentials.source, 'renewal'));
  
  console.log(`📊 Credential count after cleanup: ${afterCount[0].count}`);
  
  // Verify cleanup worked
  if (afterCount[0].count <= 3) {
    console.log('✅ SUCCESS: Cleanup worked! Only 3 or fewer credentials remain.');
  } else {
    console.log(`❌ FAILURE: Cleanup did not work. ${afterCount[0].count} credentials remain (expected max 3).`);
  }
  
  // List the remaining credentials
  const remaining = await storage.getOfficeCredentials();
  console.log('\n📋 Remaining credentials after cleanup:');
  remaining.forEach(cred => {
    console.log(`   - ID: ${cred.id}, Username: ${cred.username}, Created: ${cred.generatedAt}`);
  });
}

testCleanup().catch(console.error);