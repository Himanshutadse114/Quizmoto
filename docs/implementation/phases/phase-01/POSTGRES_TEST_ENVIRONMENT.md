# PostgreSQL Test Environment
To test the environment natively with Postgres (Phase 1 requirement):
1. Run a docker container:
`docker run --name quizmoto-postgres-test -e POSTGRES_USER=testuser -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=quizmototest -p 5433:5432 -d postgres:15-alpine`
2. Run the integration test suite:
`npm run test:postgres` (This injects the DB_DIALECT and postgres connection variables).

Tests run successfully and achieve database integration coverage over Socket.IO and the API using native Sequelize.
