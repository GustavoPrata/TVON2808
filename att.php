<?php
/**
 * Script PHP para processar upload de arquivo M3U
 * - Deleta arquivos antigos 'lista.m3u' e 'lista.m3u.gz'
 * - Salva novo conteúdo como 'lista.m3u' 
 * - Compacta em GZIP como 'lista.m3u.gz'
 * 
 * Compatível com upload via formulário HTML e requisições AJAX/CORS
 */

// Headers CORS para permitir upload do frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: text/html; charset=utf-8');

// Se for uma requisição OPTIONS (preflight), retornar apenas headers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Para requisições via navegador, permitir visualização em tempo real
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');
    ob_implicit_flush(true);
    ob_end_flush();
}

// Função para processar o upload e atualização
function atualizarListaM3U($conteudo, $isAjax = false) {
    $arquivoM3U = 'lista.m3u';
    $arquivoGZIP = 'lista.m3u.gz';
    $resultado = [];
    
    // Se não for AJAX, exibir HTML
    if (!$isAjax) {
        echo "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Atualizador de Lista M3U - Processando...</title>";
        echo "<style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
            .container { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
            h1 { color: #333; text-align: center; margin-bottom: 30px; }
            .status { color: #28a745; font-weight: 600; margin: 10px 0; padding: 10px; background: #d4edda; border-radius: 5px; }
            .error { color: #dc3545; font-weight: 600; margin: 10px 0; padding: 10px; background: #f8d7da; border-radius: 5px; }
            .info { color: #17a2b8; margin: 10px 0; padding: 10px; background: #d1ecf1; border-radius: 5px; }
            .success-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; font-size: 18px; margin-top: 20px; }
        </style></head><body><div class='container'>";
        echo "<h1>🔄 Atualizando Lista M3U</h1>";
    }
    
    try {
        // Passo 1: Deletar arquivos antigos
        if (!$isAjax) echo "<div class='info'>📋 Iniciando processo de atualização...</div>";
        
        if (file_exists($arquivoM3U)) {
            if (unlink($arquivoM3U)) {
                $msg = "✅ Arquivo antigo '$arquivoM3U' deletado";
                $resultado[] = $msg;
                if (!$isAjax) echo "<div class='status'>$msg</div>";
            }
        } else {
            $msg = "ℹ️ Arquivo '$arquivoM3U' não existia";
            $resultado[] = $msg;
            if (!$isAjax) echo "<div class='info'>$msg</div>";
        }
        
        if (file_exists($arquivoGZIP)) {
            if (unlink($arquivoGZIP)) {
                $msg = "✅ Arquivo antigo '$arquivoGZIP' deletado";
                $resultado[] = $msg;
                if (!$isAjax) echo "<div class='status'>$msg</div>";
            }
        } else {
            $msg = "ℹ️ Arquivo '$arquivoGZIP' não existia";
            $resultado[] = $msg;
            if (!$isAjax) echo "<div class='info'>$msg</div>";
        }
        
        // Passo 2: Verificar conteúdo
        if (empty($conteudo)) {
            throw new Exception("O arquivo está vazio ou inválido");
        }
        
        $tamanho = strlen($conteudo);
        $tamanhoMB = round($tamanho / 1024 / 1024, 2);
        $msg = "📦 Arquivo recebido: $tamanho bytes ($tamanhoMB MB)";
        $resultado[] = $msg;
        if (!$isAjax) echo "<div class='status'>$msg</div>";
        
        // Passo 3: Salvar novo arquivo
        if (!$isAjax) echo "<div class='info'>💾 Salvando novo arquivo '$arquivoM3U'...</div>";
        
        if (file_put_contents($arquivoM3U, $conteudo) === false) {
            throw new Exception("Erro ao salvar o arquivo '$arquivoM3U'. Verifique permissões");
        }
        
        $msg = "✅ Arquivo '$arquivoM3U' salvo com sucesso";
        $resultado[] = $msg;
        if (!$isAjax) echo "<div class='status'>$msg</div>";
        
        // Passo 4: Compactar em GZIP
        if (!$isAjax) echo "<div class='info'>🗜️ Compactando arquivo em GZIP...</div>";
        
        $conteudoGZIP = gzencode($conteudo, 9);
        if ($conteudoGZIP === false) {
            throw new Exception("Erro ao compactar o arquivo em GZIP");
        }
        
        $tamanhoGZIP = strlen($conteudoGZIP);
        $tamanhoGZIPMB = round($tamanhoGZIP / 1024 / 1024, 2);
        $reducao = round(($tamanho - $tamanhoGZIP) / $tamanho * 100, 2);
        
        $msg = "📊 Compactação: $tamanhoGZIPMB MB ($reducao% menor)";
        $resultado[] = $msg;
        if (!$isAjax) echo "<div class='status'>$msg</div>";
        
        if (file_put_contents($arquivoGZIP, $conteudoGZIP) === false) {
            throw new Exception("Erro ao salvar o arquivo '$arquivoGZIP'. Verifique permissões");
        }
        
        $msg = "✅ Arquivo '$arquivoGZIP' salvo com sucesso";
        $resultado[] = $msg;
        if (!$isAjax) echo "<div class='status'>$msg</div>";
        
        // Sucesso final
        if ($isAjax) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Lista M3U atualizada com sucesso!',
                'details' => $resultado,
                'files' => [
                    'm3u' => ['size' => $tamanho, 'sizeMB' => $tamanhoMB],
                    'gzip' => ['size' => $tamanhoGZIP, 'sizeMB' => $tamanhoGZIPMB, 'compression' => $reducao]
                ]
            ]);
        } else {
            echo "<div class='success-box'>🎉 <strong>PROCESSO CONCLUÍDO COM SUCESSO!</strong><br>Todos os arquivos foram atualizados.</div>";
            echo "<div style='text-align: center; margin-top: 20px;'>
                    <a href='lista.m3u' style='margin: 0 10px; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; display: inline-block;'>📥 Baixar lista.m3u</a>
                    <a href='lista.m3u.gz' style='margin: 0 10px; padding: 10px 20px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px; display: inline-block;'>📥 Baixar lista.m3u.gz</a>
                  </div>";
            echo "</div></body></html>";
        }
        
    } catch (Exception $e) {
        if ($isAjax) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
                'details' => $resultado
            ]);
        } else {
            echo "<div class='error'>❌ Erro: " . htmlspecialchars($e->getMessage()) . "</div>";
            echo "</div></body></html>";
        }
    }
}

// Detectar se é uma requisição AJAX
$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

// Verificar se houve upload de arquivo via POST
if (isset($_FILES['arquivo_m3u']) && $_FILES['arquivo_m3u']['error'] === UPLOAD_ERR_OK) {
    $arquivoTmp = $_FILES['arquivo_m3u']['tmp_name'];
    $nomeOriginal = basename($_FILES['arquivo_m3u']['name']);
    $extensao = strtolower(pathinfo($nomeOriginal, PATHINFO_EXTENSION));
    
    // Verificar extensão
    if ($extensao !== 'm3u') {
        if ($isAjax) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'O arquivo deve ter extensão .m3u'
            ]);
        } else {
            echo "<!DOCTYPE html><html><body>";
            echo "<div style='color: red; font-weight: bold; padding: 20px;'>❌ Erro: O arquivo deve ter extensão .m3u</div>";
            echo "</body></html>";
        }
        exit;
    }
    
    // Ler conteúdo do arquivo
    $conteudo = file_get_contents($arquivoTmp);
    if ($conteudo === false) {
        if ($isAjax) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao ler o arquivo enviado'
            ]);
        } else {
            echo "<!DOCTYPE html><html><body>";
            echo "<div style='color: red; font-weight: bold; padding: 20px;'>❌ Erro ao ler o arquivo enviado</div>";
            echo "</body></html>";
        }
        exit;
    }
    
    atualizarListaM3U($conteudo, $isAjax);
    
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Se for POST mas sem arquivo, retornar erro
    if ($isAjax) {
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Nenhum arquivo foi enviado'
        ]);
    } else {
        echo "<!DOCTYPE html><html><body>";
        echo "<div style='color: red; font-weight: bold; padding: 20px;'>❌ Erro: Nenhum arquivo foi enviado</div>";
        echo "</body></html>";
    }
} else {
    // Exibir formulário de upload
    ?>
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TV ON - Atualizador de Lista M3U</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 40px;
                max-width: 500px;
                width: 100%;
            }
            .logo {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo h1 {
                color: #667eea;
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 5px;
            }
            .logo p {
                color: #666;
                font-size: 14px;
            }
            .upload-area {
                border: 2px dashed #ddd;
                border-radius: 10px;
                padding: 40px 20px;
                text-align: center;
                transition: all 0.3s ease;
                cursor: pointer;
                background: #f8f9fa;
            }
            .upload-area:hover {
                border-color: #667eea;
                background: #f0f0ff;
            }
            .upload-area.drag-over {
                border-color: #667eea;
                background: #e6e6ff;
            }
            .upload-icon {
                font-size: 48px;
                color: #667eea;
                margin-bottom: 15px;
            }
            input[type="file"] {
                display: none;
            }
            .file-label {
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 25px;
                cursor: pointer;
                transition: transform 0.3s ease;
                font-weight: 600;
            }
            .file-label:hover {
                transform: translateY(-2px);
            }
            .selected-file {
                margin-top: 20px;
                padding: 15px;
                background: #e8f5e9;
                border-radius: 8px;
                color: #2e7d32;
                display: none;
            }
            button[type="submit"] {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.3s ease;
                margin-top: 20px;
            }
            button[type="submit"]:hover {
                transform: translateY(-2px);
            }
            button[type="submit"]:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .info-box {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                color: #1565c0;
                font-size: 14px;
            }
            .info-box strong {
                display: block;
                margin-bottom: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>📺 TV ON</h1>
                <p>Atualizador de Lista M3U</p>
            </div>
            
            <form method="POST" enctype="multipart/form-data" id="uploadForm">
                <div class="upload-area" id="uploadArea">
                    <div class="upload-icon">📁</div>
                    <p style="color: #666; margin-bottom: 15px;">Arraste seu arquivo M3U aqui ou</p>
                    <label for="arquivo_m3u" class="file-label">Escolher Arquivo</label>
                    <input type="file" id="arquivo_m3u" name="arquivo_m3u" accept=".m3u" required>
                </div>
                
                <div class="selected-file" id="selectedFile">
                    <strong>📄 Arquivo selecionado:</strong>
                    <span id="fileName"></span>
                </div>
                
                <button type="submit" id="submitBtn" disabled>Atualizar Lista M3U</button>
            </form>
            
            <div class="info-box">
                <strong>ℹ️ Informações:</strong>
                • O processo deletará os arquivos antigos<br>
                • Salvará o novo arquivo como lista.m3u<br>
                • Criará versão compactada lista.m3u.gz<br>
                • Tamanho máximo suportado: ~100MB
            </div>
        </div>
        
        <script>
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('arquivo_m3u');
            const selectedFile = document.getElementById('selectedFile');
            const fileName = document.getElementById('fileName');
            const submitBtn = document.getElementById('submitBtn');
            
            // Click para selecionar arquivo
            uploadArea.addEventListener('click', () => fileInput.click());
            
            // Prevenir propagação do click no input
            fileInput.addEventListener('click', (e) => e.stopPropagation());
            
            // Arquivo selecionado
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    fileName.textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
                    selectedFile.style.display = 'block';
                    submitBtn.disabled = false;
                }
            });
            
            // Drag and drop
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.classList.add('drag-over');
                }, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.classList.remove('drag-over');
                }, false);
            });
            
            uploadArea.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length > 0) {
                    fileInput.files = files;
                    const file = files[0];
                    fileName.textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
                    selectedFile.style.display = 'block';
                    submitBtn.disabled = false;
                }
            });
        </script>
    </body>
    </html>
    <?php
}
?>