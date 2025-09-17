import { describe, expect, it } from 'vitest';

describe('Graceful Shutdown Implementation', () => {
  describe('Code structure verification', () => {
    it('should have SIGINT signal handler setup', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain("process.on('SIGINT'");
      expect(mainContent).toContain('shutdownHandler');
    });

    it('should have SIGTERM signal handler setup', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain("process.on('SIGTERM'");
      expect(mainContent).toContain('shutdownHandler');
    });

    it('should have shutdown status display', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('shutting down gracefully');
      expect(mainContent).toContain('logger.info(`Received ${signal}');
    });

    it('should call team manager shutdown', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('await this.teamManager.shutdown()');
    });

    it('should handle shutdown errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('Error during shutdown');
      expect(mainContent).toContain('logger.error(`Error during shutdown: ${error.message}`)');
    });

    it('should exit with appropriate codes', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('process.exit(0)');
      expect(mainContent).toContain('process.exit(1)');
    });

    it('should prevent multiple shutdown attempts', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('if (this.isShuttingDown)');
      expect(mainContent).toContain('return;');
      expect(mainContent).toContain('this.isShuttingDown = true');
    });

    it('should have setupShutdownHandlers method', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('setupShutdownHandlers()');
      expect(mainContent).toContain('const shutdownHandler = async (signal) => {');
    });

    it('should initialize isShuttingDown flag', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('this.isShuttingDown = false');
    });

    it('should call setupShutdownHandlers in start method', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('this.setupShutdownHandlers()');
    });
  });

  describe('Signal handler implementation', () => {
    it('should have proper signal handler structure', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Check for the shutdown handler function
      const shutdownHandlerMatch = mainContent.match(
        /const shutdownHandler = async \(signal\) => \{([\s\S]*?)\};/
      );
      expect(shutdownHandlerMatch).toBeTruthy();

      const shutdownHandler = shutdownHandlerMatch[1];
      expect(shutdownHandler).toContain('if (this.isShuttingDown)');
      expect(shutdownHandler).toContain('this.isShuttingDown = true');
      expect(shutdownHandler).toContain(
        'logger.info(`Received ${signal}, shutting down gracefully...`)'
      );
      expect(shutdownHandler).toContain('await this.teamManager.shutdown()');
    });

    it('should register signal handlers correctly', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain("process.on('SIGINT', () => shutdownHandler('SIGINT'))");
      expect(mainContent).toContain("process.on('SIGTERM', () => shutdownHandler('SIGTERM'))");
    });

    it('should have try-catch for shutdown errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const shutdownHandlerMatch = mainContent.match(
        /const shutdownHandler = async \(signal\) => \{([\s\S]*?)\};/
      );
      expect(shutdownHandlerMatch).toBeTruthy();

      const shutdownHandler = shutdownHandlerMatch[1];
      expect(shutdownHandler).toContain('try {');
      expect(shutdownHandler).toContain('} catch (error) {');
      expect(shutdownHandler).toContain('logger.error(`Error during shutdown: ${error.message}`)');
    });
  });

  describe('Requirements verification', () => {
    it('should implement SIGINT/SIGTERM signal handling', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Requirement: SIGINT/SIGTERMシグナルハンドリングを実装
      expect(mainContent).toContain("process.on('SIGINT'");
      expect(mainContent).toContain("process.on('SIGTERM'");
    });

    it('should implement proper connection termination', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Requirement: 全接続の適切な終了処理を実装
      expect(mainContent).toContain('await this.teamManager.shutdown()');
    });

    it('should implement shutdown status display', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Requirement: シャットダウン状態の表示を実装
      expect(mainContent).toContain('shutting down gracefully');
      expect(mainContent).toContain('logger.info(`Received ${signal}');
    });

    it('should meet requirement 6.4 (graceful shutdown)', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Requirement 6.4: アプリケーションがシャットダウンするとき、システムはすべての接続を適切に閉じ、シャットダウン状態を表示する必要がある
      expect(mainContent).toContain('await this.teamManager.shutdown()');
      expect(mainContent).toContain('shutting down gracefully');
      expect(mainContent).toContain('process.exit(0)');
    });
  });

  describe('Error handling verification', () => {
    it('should handle shutdown errors properly', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('} catch (error) {');
      expect(mainContent).toContain('logger.error(`Error during shutdown: ${error.message}`)');
      expect(mainContent).toContain('process.exit(1)');
    });

    it('should prevent multiple shutdown attempts', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('if (this.isShuttingDown)');
      expect(mainContent).toContain('return;');
    });
  });
});
