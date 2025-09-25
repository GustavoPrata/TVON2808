<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/database.php';

class TVSystemAPI {
    private $db;
    private $connection;
    
    public function __construct() {
        $this->db = new Database();
        $this->connection = $this->db->getConnection();
    }

    private function validateApiKey() {
        $apiKey = null;
        
        // Verificar se a chave foi enviada no header Authorization
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $apiKey = str_replace('Bearer ', '', $headers['Authorization']);
        }
        // Verificar se a chave foi enviada no header X-API-Key
        elseif (isset($headers['X-API-Key'])) {
            $apiKey = $headers['X-API-Key'];
        }
        // Verificar se a chave foi enviada como parâmetro GET
        elseif (isset($_GET['key'])) {
            $apiKey = $_GET['key'];
        }
        // Verificar se a chave foi enviada no body (para POST/PUT)
        else {
            $input = json_decode(file_get_contents('php://input'), true);
            if (isset($input['key'])) {
                $apiKey = $input['key'];
            }
        }
        
        // Validar a chave
        if ($apiKey !== 'key170604') {
            $this->sendResponse(401, [
                'error' => 'Unauthorized', 
                'message' => 'Invalid or missing API key'
            ]);
            return false;
        }
        
        return true;
    }
    
    public function handleRequest() {
        // Validar API Key antes de processar qualquer requisição
        if (!$this->validateApiKey()) {
            return;
        }
        
        $method = $_SERVER['REQUEST_METHOD'];
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $pathParts = explode('/', trim($path, '/'));
        
        // Remove 'api' from path if present
        if ($pathParts[0] === 'api') {
            array_shift($pathParts);
        }
        
        $resource = $pathParts[0] ?? '';
        $action = $pathParts[1] ?? '';
        $id = $pathParts[2] ?? null;
        
        try {
            switch ($resource) {
                case 'users':
                    $this->handleUsers($method, $action, $id);
                    break;
                case 'system_credentials':
                    $this->handleSystemCredentials($method, $action, $id);
                    break;
                case 'settings':
                    $this->handleSettings($method, $action, $id);
                    break;
                default:
                    $this->sendResponse(404, ['error' => 'Endpoint not found']);
            }
        } catch (Exception $e) {
            $this->sendResponse(500, ['error' => 'Internal server error', 'message' => $e->getMessage()]);
        }
    }
    
    // USERS ENDPOINTS
    private function handleUsers($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($action === 'get' && $id) {
                    $this->getUser($id);
                } elseif ($action === 'get' || $action === '') {
                    $this->getAllUsers();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid GET action for users']);
                }
                break;
            case 'POST':
                if ($action === 'adicionar') {
                    $this->addUser();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid POST action for users']);
                }
                break;
            case 'PUT':
                if ($action === 'editar' && $id) {
                    $this->editUser($id);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid PUT action for users']);
                }
                break;
            case 'DELETE':
                if ($action === 'apagar' && $id) {
                    $this->deleteUser($id);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid DELETE action for users']);
                }
                break;
            default:
                $this->sendResponse(405, ['error' => 'Method not allowed']);
        }
    }
    
    private function getAllUsers() {
        $query = "SELECT * FROM users ORDER BY id DESC";
        $result = $this->connection->query($query);
        
        if ($result) {
            $users = [];
            while ($row = $result->fetch_assoc()) {
                $users[] = $row;
            }
            $this->sendResponse(200, ['success' => true, 'data' => $users]);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to fetch users']);
        }
    }
    
    private function getUser($id) {
        $stmt = $this->connection->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($user = $result->fetch_assoc()) {
            $this->sendResponse(200, ['success' => true, 'data' => $user]);
        } else {
            $this->sendResponse(404, ['error' => 'User not found']);
        }
    }
    
    private function addUser() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['username']) || !isset($input['password'])) {
            $this->sendResponse(400, ['error' => 'Username and password are required']);
            return;
        }
        
        $username = $input['username'];
        $password = $input['password'];
        $status = $input['status'] ?? 'Active';
        $exp_date = $input['exp_date'] ?? '';
        $system = $input['system'] ?? 1;
        
        // CORREÇÃO: Usar backticks para o campo system que é palavra reservada no MySQL
        $stmt = $this->connection->prepare("INSERT INTO users (username, password, status, exp_date, `system`) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssi", $username, $password, $status, $exp_date, $system);
        
        if ($stmt->execute()) {
            $this->sendResponse(201, ['success' => true, 'message' => 'User created successfully', 'id' => $this->connection->insert_id]);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to create user: ' . $stmt->error]);
        }
    }
    
    private function editUser($id) {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            $this->sendResponse(400, ['error' => 'Invalid input data']);
            return;
        }
        
        $fields = [];
        $values = [];
        $types = '';
        
        if (isset($input['username'])) {
            $fields[] = 'username = ?';
            $values[] = $input['username'];
            $types .= 's';
        }
        if (isset($input['password'])) {
            $fields[] = 'password = ?';
            $values[] = $input['password'];
            $types .= 's';
        }
        if (isset($input['status'])) {
            $fields[] = 'status = ?';
            $values[] = $input['status'];
            $types .= 's';
        }
        if (isset($input['exp_date'])) {
            $fields[] = 'exp_date = ?';
            $values[] = $input['exp_date'];
            $types .= 's';
        }
        if (isset($input['system'])) {
            // CORREÇÃO: Usar backticks para o campo system
            $fields[] = '`system` = ?';
            $values[] = $input['system'];
            $types .= 'i';
        }
        
        if (empty($fields)) {
            $this->sendResponse(400, ['error' => 'No fields to update']);
            return;
        }
        
        $values[] = $id;
        $types .= 'i';
        
        $query = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $this->connection->prepare($query);
        $stmt->bind_param($types, ...$values);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'User updated successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'User not found or no changes made']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to update user: ' . $stmt->error]);
        }
    }
    
    private function deleteUser($id) {
        $stmt = $this->connection->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'User deleted successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'User not found']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to delete user']);
        }
    }
    
    // SYSTEM CREDENTIALS ENDPOINTS
    private function handleSystemCredentials($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($action === 'get' && $id) {
                    $this->getSystemCredential($id);
                } elseif ($action === 'get' || $action === '') {
                    $this->getAllSystemCredentials();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid GET action for system_credentials']);
                }
                break;
            case 'POST':
                if ($action === 'adicionar') {
                    $this->addSystemCredential();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid POST action for system_credentials']);
                }
                break;
            case 'PUT':
                if ($action === 'editar' && $id) {
                    $this->editSystemCredential($id);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid PUT action for system_credentials']);
                }
                break;
            case 'DELETE':
                if ($action === 'apagar' && $id) {
                    $this->deleteSystemCredential($id);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid DELETE action for system_credentials']);
                }
                break;
            default:
                $this->sendResponse(405, ['error' => 'Method not allowed']);
        }
    }
    
    private function getAllSystemCredentials() {
        $query = "SELECT * FROM system_credentials ORDER BY system_id";
        $result = $this->connection->query($query);
        
        if ($result) {
            $credentials = [];
            while ($row = $result->fetch_assoc()) {
                $credentials[] = $row;
            }
            $this->sendResponse(200, ['success' => true, 'data' => $credentials]);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to fetch system credentials']);
        }
    }
    
    private function getSystemCredential($id) {
        $stmt = $this->connection->prepare("SELECT * FROM system_credentials WHERE system_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($credential = $result->fetch_assoc()) {
            $this->sendResponse(200, ['success' => true, 'data' => $credential]);
        } else {
            $this->sendResponse(404, ['error' => 'System credential not found']);
        }
    }
    
    private function addSystemCredential() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['system_id']) || !isset($input['username']) || !isset($input['password'])) {
            $this->sendResponse(400, ['error' => 'System ID, username and password are required']);
            return;
        }
        
        $stmt = $this->connection->prepare("INSERT INTO system_credentials (system_id, username, password) VALUES (?, ?, ?)");
        $stmt->bind_param("iss", $input['system_id'], $input['username'], $input['password']);
        
        if ($stmt->execute()) {
            $this->sendResponse(201, ['success' => true, 'message' => 'System credential created successfully']);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to create system credential']);
        }
    }
    
    private function editSystemCredential($id) {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            $this->sendResponse(400, ['error' => 'Invalid input data']);
            return;
        }
        
        $fields = [];
        $values = [];
        $types = '';
        
        if (isset($input['username'])) {
            $fields[] = 'username = ?';
            $values[] = $input['username'];
            $types .= 's';
        }
        if (isset($input['password'])) {
            $fields[] = 'password = ?';
            $values[] = $input['password'];
            $types .= 's';
        }
        
        if (empty($fields)) {
            $this->sendResponse(400, ['error' => 'No fields to update']);
            return;
        }
        
        $values[] = $id;
        $types .= 'i';
        
        $query = "UPDATE system_credentials SET " . implode(', ', $fields) . " WHERE system_id = ?";
        $stmt = $this->connection->prepare($query);
        $stmt->bind_param($types, ...$values);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'System credential updated successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'System credential not found']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to update system credential']);
        }
    }
    
    private function deleteSystemCredential($id) {
        $stmt = $this->connection->prepare("DELETE FROM system_credentials WHERE system_id = ?");
        $stmt->bind_param("i", $id);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'System credential deleted successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'System credential not found']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to delete system credential']);
        }
    }
    
    // SETTINGS ENDPOINTS
    private function handleSettings($method, $action, $key) {
        switch ($method) {
            case 'GET':
                if ($action === 'get' && $key) {
                    $this->getSetting($key);
                } elseif ($action === 'get' || $action === '') {
                    $this->getAllSettings();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid GET action for settings']);
                }
                break;
            case 'POST':
                if ($action === 'adicionar') {
                    $this->addSetting();
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid POST action for settings']);
                }
                break;
            case 'PUT':
                if ($action === 'editar' && $key) {
                    $this->editSetting($key);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid PUT action for settings']);
                }
                break;
            case 'DELETE':
                if ($action === 'apagar' && $key) {
                    $this->deleteSetting($key);
                } else {
                    $this->sendResponse(400, ['error' => 'Invalid DELETE action for settings']);
                }
                break;
            default:
                $this->sendResponse(405, ['error' => 'Method not allowed']);
        }
    }
    
    private function getAllSettings() {
        $query = "SELECT * FROM settings ORDER BY setting_key";
        $result = $this->connection->query($query);
        
        if ($result) {
            $settings = [];
            while ($row = $result->fetch_assoc()) {
                $settings[] = $row;
            }
            $this->sendResponse(200, ['success' => true, 'data' => $settings]);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to fetch settings']);
        }
    }
    
    private function getSetting($key) {
        $stmt = $this->connection->prepare("SELECT * FROM settings WHERE setting_key = ?");
        $stmt->bind_param("s", $key);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($setting = $result->fetch_assoc()) {
            $this->sendResponse(200, ['success' => true, 'data' => $setting]);
        } else {
            $this->sendResponse(404, ['error' => 'Setting not found']);
        }
    }
    
    private function addSetting() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['setting_key']) || !isset($input['setting_value'])) {
            $this->sendResponse(400, ['error' => 'Setting key and value are required']);
            return;
        }
        
        $stmt = $this->connection->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)");
        $stmt->bind_param("ss", $input['setting_key'], $input['setting_value']);
        
        if ($stmt->execute()) {
            $this->sendResponse(201, ['success' => true, 'message' => 'Setting created successfully']);
        } else {
            $this->sendResponse(500, ['error' => 'Failed to create setting']);
        }
    }
    
    private function editSetting($key) {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['setting_value'])) {
            $this->sendResponse(400, ['error' => 'Setting value is required']);
            return;
        }
        
        $stmt = $this->connection->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?");
        $stmt->bind_param("ss", $input['setting_value'], $key);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'Setting updated successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'Setting not found']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to update setting']);
        }
    }
    
    private function deleteSetting($key) {
        $stmt = $this->connection->prepare("DELETE FROM settings WHERE setting_key = ?");
        $stmt->bind_param("s", $key);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $this->sendResponse(200, ['success' => true, 'message' => 'Setting deleted successfully']);
            } else {
                $this->sendResponse(404, ['error' => 'Setting not found']);
            }
        } else {
            $this->sendResponse(500, ['error' => 'Failed to delete setting']);
        }
    }
    
    private function sendResponse($statusCode, $data) {
        http_response_code($statusCode);
        echo json_encode($data, JSON_PRETTY_PRINT);
        exit;
    }
    
    public function __destruct() {
        if ($this->connection) {
            $this->connection->close();
        }
    }
}

// Initialize and handle the request
$api = new TVSystemAPI();
$api->handleRequest();
?>