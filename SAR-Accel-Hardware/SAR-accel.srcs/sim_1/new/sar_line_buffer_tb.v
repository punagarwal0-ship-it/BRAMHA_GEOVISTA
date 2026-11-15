`timescale 1ns/1ps
module sar_line_buffer_tb;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, valid_in;
    reg [7:0] pixel_in;
    reg [15:0] x, y;
    wire [7:0] p0,p1,p2,p3,p4,p5,p6,p7,p8;
    wire window_valid;
    integer errors;

    sar_line_buffer #(.IMAGE_WIDTH(4), .IMAGE_HEIGHT(3), .COORD_WIDTH(16)) dut (
        .clk(clk), .rst(rst), .pixel_in(pixel_in), .valid_in(valid_in),
        .x(x), .y(y), .p0(p0), .p1(p1), .p2(p2),
        .p3(p3), .p4(p4), .p5(p5), .p6(p6), .p7(p7), .p8(p8),
        .window_valid(window_valid)
    );

    task send_pixel;
        input [15:0] tx, ty;
        input [7:0] value;
        input expected_valid;
        input [71:0] expected_window;
        begin
            @(negedge clk);
            x=tx; y=ty; pixel_in=value; valid_in=1'b1;
            @(posedge clk); #1;
            if (window_valid !== expected_valid) begin
                $display("FAIL valid at (%0d,%0d): expected %b got %b", tx,ty,expected_valid,window_valid);
                errors=errors+1;
            end
            if (expected_valid &&
                {p0,p1,p2,p3,p4,p5,p6,p7,p8} !== expected_window) begin
                $display("FAIL window at (%0d,%0d): expected %h got %h", tx,ty,expected_window,
                         {p0,p1,p2,p3,p4,p5,p6,p7,p8});
                errors=errors+1;
            end
        end
    endtask

    integer i;
    initial begin
        errors=0; rst=1; valid_in=0; pixel_in=0; x=0; y=0;
        repeat (2) @(posedge clk);
        @(negedge clk); rst=0;

        // Rows are 1..4, 11..14, 21..24. Only two complete windows exist.
        for (i=0; i<4; i=i+1) send_pixel(i,0,i+1,1'b0,72'd0);
        for (i=0; i<4; i=i+1) send_pixel(i,1,i+11,1'b0,72'd0);
        send_pixel(0,2,21,1'b0,72'd0);
        send_pixel(1,2,22,1'b0,72'd0);
        send_pixel(2,2,23,1'b1,{8'd1,8'd2,8'd3,8'd11,8'd12,8'd13,8'd21,8'd22,8'd23});
        send_pixel(3,2,24,1'b1,{8'd2,8'd3,8'd4,8'd12,8'd13,8'd14,8'd22,8'd23,8'd24});

        @(negedge clk); valid_in=0;
        @(posedge clk); #1;
        if (window_valid !== 1'b0) begin
            $display("FAIL window_valid stayed high during invalid cycle"); errors=errors+1;
        end
        if (errors==0) $display("PASS: sar_line_buffer_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
