const { io } = require('socket.io-client');

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
    
    socket.emit('testing', { message: 'Test message from client' });
     socket.emit('start_learning', {
        userId: '68bc6e354fa5a967b096332e',
        courseId: '68c45d154d7fca822043d6b3',
        chunkId: '1af56cce-cc04-4242-9260-598620bf8566'
    });
});


socket.on('testing_response', (response) => {
  console.log('Received testing response:', response);
  socket.send('Thank you for the response!');
});


socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});